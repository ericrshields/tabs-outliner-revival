# 5. Serialization & Storage

## 5.1 Module Map

| File | Purpose |
|------|---------|
| `src/serialization/hierarchy-jso.ts` | HierarchyJSO validation, normalization, node counting, comparison, `.tree` file I/O |
| `src/serialization/entry-codec.ts` | EntryWireFormat tuple ↔ SerializedNode codec |
| `src/serialization/operations-codec.ts` | Operations log ↔ HierarchyJSO codec |
| `src/serialization/knot-resolver.ts` | DiffSnapshot (knot-based) → HierarchyJSO resolution |
| `src/serialization/knot-codec.ts` | Subnodes diff codec (delta serialize/restore/compare) |
| `src/serialization/base36.ts` | Base-36 integer encoding utilities |
| `src/serialization/constants.ts` | Wire format separator characters |
| `src/serialization/html-export.ts` | TreeNode → HTML `<li>/<ul>` export |
| `src/storage/tree-storage.ts` | chrome.storage.local read/write for HierarchyJSO |
| `src/storage/settings-storage.ts` | AppSettings + dedication-seen flag persistence |
| `src/storage/migration.ts` | Legacy IndexedDB → chrome.storage.local migration orchestrator |
| `src/storage/indexeddb-reader.ts` | Read-only access to legacy V33/V34 IndexedDB |

---

## 5.2 HierarchyJSO

Canonical tree interchange format: `{ n: SerializedNode, s?: HierarchyJSO[] }`. Used for chrome.storage.local persistence, `.tree` file import/export, round-trip validation during migration, and as the output of operations log conversion and knot resolution.

See `src/types/serialized.ts` for interface definition. See `src/serialization/hierarchy-jso.ts` for validation (`isValidHierarchyJSO`), `countNodes`, `hierarchiesEqual`, `importTreeFile`, and `exportTreeFile`.

---

## 5.3 SerializedNode

Defined in `src/types/serialized.ts`. See source for full interface.

### Space Optimizations

- **`type` omission**: The most common node type (`savedtab`) is the default when `type` is absent. This saves bytes on every tab node in serialized data.
- **`marks` omission**: Omitted when the node has no custom marks (only default empty relicons).
- **`colapsed` omission**: Omitted when `false` (the default). Note the intentional typo `colapsed` (single `l`) -- this is a **legacy data contract** and cannot be renamed without breaking serialization compatibility.

### NodeMarks

See section 4 for the full `NodeMarks` and `TileObj` shape definitions.

### Normalization of Legacy Mangled Fields

`normalizeSerializedNode()` in `hierarchy-jso.ts` fixes Closure Compiler name-mangled fields from legacy versions v0.4.27 and v0.4.28. Must be idempotent.

| Mangled Key | Target Field | Legacy Version | Notes |
|-------------|-------------|----------------|-------|
| `U` | `customColorActive` | v0.4.28 | |
| `V` | `customColorSaved` | v0.4.28 | |
| `J` | `customTitle` | v0.4.27 | Overridden by `W` if both present |
| `u` | `customFavicon` | v0.4.27 | Overridden by `I` if both present |
| `W` | `customTitle` | v0.4.28 | Takes priority over `J` |
| `I` | `customFavicon` | v0.4.28 | Takes priority over `u` |

Additional normalization:
- `marks.relicons` is always coerced to a proper array (handles missing, null, non-array inputs)
- Default `type` assignment: absent type defaults to `'savedtab'` (applied at decode time in entry-codec, not here)

---

## 5.4 Entry Codec

File: `src/serialization/entry-codec.ts`. See source for `encodeEntry`/`decodeEntry` signatures and `EntryWireFormat` type.

### Sign-Bit Collapsed Encoding

The wire format is a JSON tuple `[typeCode, data, marks?]` where the **sign bit of `typeCode` encodes collapsed state**: negative typeCode means the node is collapsed. Index 0 (`ZERO`) is reserved specifically to make this work (negative zero has no distinct representation).

Type code mapping is defined in `NODE_TYPE_NUM2STR` / `NODE_TYPE_STR2NUM` in `src/types/enums.ts`. **Order is a serialization contract** -- DO NOT reorder, insert, or remove entries. Out-of-range or unknown type codes default to `'savedtab'`.

**Note**: Marks normalization (mangled field names) is NOT done in entry-codec. It happens in `normalizeSerializedNode()` in hierarchy-jso.ts, which is called during operations log and knot resolution.

---

## 5.5 Operations Codec

File: `src/serialization/operations-codec.ts`. See source for wire format types (`WireRootOp`, `WireInsertOp`, `WireEofOp`) and `DbOperationEnum` values in `src/types/enums.ts`.

### Path Semantics

Insert operation paths are arrays of child indices: `[parentChildIdx_0, parentChildIdx_1, ..., insertionPosition]`.

- All indices except the last navigate parent→child through the `s` (subnodes) arrays to locate the target container.
- The last index is the insertion position within that container's children (splice semantics).
- Corrupt/out-of-range paths are silently skipped (defensive coding from legacy).

Example: `[0, 2, 1]` means: take child 0 of root, then child 2 of that node, then insert at position 1 in that node's children.

### Conversion Functions

`operationsToHierarchy` (port of `restoreTreeFromOperations` from treemodel.js:2640-2671) replays `NODE_NEWROOT` + `NODE_INSERT` operations to build a `HierarchyJSO`. Returns `null` for empty operations (fresh install path). `hierarchyToOperations` is the inverse (DFS traversal emitting insert ops).

`validateOperationsLog` checks structure: non-empty array, first op is `NODE_NEWROOT` (2000), last is `EOF` (11111). Returns `{ valid, reason?, nodeCount?, saveTime? }`.

---

## 5.6 Knot Resolver

File: `src/serialization/knot-resolver.ts`

The knot system is the legacy diff-based serialization format. A "knot" is a compact string encoding of a node's identity and its children list, potentially referencing a base knot for delta compression.

### DiffSnapshot Interface

```typescript
interface DiffSnapshot {
  readonly rootDid: string;                          // Root node's difference ID (base-36)
  readonly allKnots: ReadonlyMap<string, string>;    // dId → knot content string
  readonly entries: ReadonlyMap<string, string>;      // cdId → JSON(EntryWireFormat)
}
```

### 4 Knot Encoding Variants

Knot content strings use `#` (CDID_SDID_SEPARATOR) and `@` (CDID_SUBNODESLIST_SEPARATOR) as delimiters:

| Variant | Format | Meaning |
|---------|--------|---------|
| 1 | `"cdId"` | Node with no subnodes |
| 2 | `"cdId@dId&dId&dId"` | Node with inline subnodes list (ampersand-separated dIds) |
| 3 | `"cdId#sdId"` | Node referencing a base knot for its children (recursive lookup) |
| 4 | `"cdId#sdId#deltaOps"` | Node referencing a base knot + applying delta operations |

Where:
- `cdId` = content difference ID (indexes into `entries` map to get the EntryWireFormat JSON)
- `sdId` = subnodes difference ID (indexes into `allKnots` map for the base knot)
- `dId` = node difference ID (unique identifier for each node instance)
- All IDs are base-36 encoded strings

### Subnodes Delta Operations (knot-codec.ts)

Used in Variant 4. The `deltaOps` string is pipe-separated (`|`), with each operation being:

| Op | Format | Meaning |
|----|--------|---------|
| Use | `"*"` or `"*N"` | Use N elements from base array (default N=1). N is base-36. |
| Skip | `"-"` or `"-N"` | Skip N elements from base, then use the next one (default N=1). N is base-36. |
| Insert | raw DID string | New element not in the base array |

`restoreSubnodesList(base, changesStr)`: Applies delta ops to the base array to reconstruct the current subnodes list.

`serializeCurSubnodes(current, base)`: Encodes the current subnodes as a delta against the base.

### Resolution Process (`resolveKnotsToHierarchy`)

1. Start with `snapshot.rootDid`
2. For each node (recursive):
   a. Look up knot content from `allKnots` map
   b. Parse knot to extract `cdId` and subnodes dIds (following variant rules)
   c. For Variant 3/4: recursively resolve base knot to get base subnodes list, then optionally apply delta
   d. Build `SerializedNode` from entry data (via `decodeEntry` + `normalizeSerializedNode`)
   e. Root node always gets type `SESSION` with `{ treeId: 'none', nextDId: 0 }`
   f. Missing entries produce a `TEXTNOTE` placeholder: `{ note: '[No content available]' }`
   g. Recursively resolve all child dIds

### Cycle Detection

Two independent cycle detection sets:
- **`visited: Set<string>`**: Tracks visited dIds in the node resolution tree. If a dId is encountered twice, returns a `TEXTNOTE` placeholder: `{ note: '[CYCLE DETECTED in tree structure]' }`
- **`knotVisited: Set<string>`**: Tracks visited knot dIds in the base-reference chain (Variant 3/4 recursion). Breaks base-reference cycles by returning empty subnodes.

### Wire Format Constants

Defined in `src/serialization/constants.ts`:

| Constant | Value | Usage |
|----------|-------|-------|
| `CDID_SDID_SEPARATOR` | `'#'` | Separates cdId from sdId in knot strings |
| `CDID_SUBNODESLIST_SEPARATOR` | `'@'` | Separates cdId from inline subnodes list |
| `OPS_SEPARATOR` | `'\|'` | Separates individual delta operations |
| `SUBNODES_DIDS_SEPARATOR` | `'&'` | Separates DID entries in subnodes list |
| `OPS_COMPONENTS_SEPARATOR` | `'='` | Separates components within a single delta operation |
| `NEW_DIDS_SEPARATOR` | `'/'` | Separates new DID entries |

---

## 5.7 HTML Export

File: `src/serialization/html-export.ts`

Serializes an in-memory `TreeNode` to an HTML `<li>/<ul>` format that round-trips through the `parseHtmlTreeDrop` import parser in `drag-import.ts`. Tabs render as `<a href>` links, containers as plain `<li>` text, children wrapped in `<ul>`. Text notes with content reimport as `savedwin` (accepted trade-off). See source for `getDisplayText` logic and entity encoding.

---

## 5.8 Tree Storage

File: `src/storage/tree-storage.ts`

Stores the full `HierarchyJSO` under key `'tabs_outliner_tree'` in `chrome.storage.local`. Three functions: `loadTree` (read + validate, null if missing/invalid), `saveTree` (write), `treeExists` (existence check).

---

## 5.9 Settings Storage

File: `src/storage/settings-storage.ts`

Stores `AppSettings` (4 boolean settings) under `'tabs_outliner_settings'` and a `'dedication_seen'` flag. Uses read-merge-write pattern so new settings keys automatically get defaults. See `src/types/settings.ts` for `AppSettings` interface and `SETTINGS_DEFAULTS`.

---

## 5.10 Migration

File: `src/storage/migration.ts`

### Overview

Migrates tree data from the legacy Tabs Outliner IndexedDB to chrome.storage.local. The legacy IndexedDB is **never deleted** -- it remains as a fallback.

### Legacy IndexedDB Configurations

Defined in `src/storage/indexeddb-reader.ts`:

| Config | DB Name | Version | Object Store | Key |
|--------|---------|---------|-------------|-----|
| `DB_V34` | `TabsOutlinerDB34` | 34 | `current_session_snapshot` | `'currentSessionSnapshot'` |
| `DB_V33` | `TabsOutlinerDB2` | 33 | `current_session_snapshot` | `'currentSessionSnapshot'` |

The raw IndexedDB record shape is `{ key: string, data: unknown[] }`. The `data` array is the operations log.

### Migration Flow

```
isMigrationNeeded() → !(await treeExists())

migrateFromLegacy():
  1. If treeExists() → return { success: true, source: 'new-storage' }
  2. Try V34:
     a. legacyDbExists(DB_V34) → false? → skip to step 3
     b. readLegacyDB(DB_V34) → operations array
     c. validateOperationsLog(operations)
     d. operationsToHierarchy(operations) → HierarchyJSO
     e. countNodes(hierarchy)
     f. saveTree(hierarchy)
     g. loadTree() → reloaded (round-trip read-back)
     h. hierarchiesEqual(hierarchy, reloaded) → must be true
     i. Return success result
  3. Try V33 (same flow as step 2 with DB_V33)
  4. Return { success: true, source: 'fresh-install', nodeCount: 0 }
```

### Round-Trip Validation

After writing to chrome.storage.local, the migration reads the data back and does a deep comparison (`hierarchiesEqual`) to verify no data was lost in the save/load cycle. Failure at this step returns `{ success: false }` with a descriptive error.

### legacyDbExists Detection

Uses `indexedDB.databases()` (Chromium 100+) when available. Falls back to opening the DB at the expected version and checking:
- If `onupgradeneeded` fires, the DB didn't exist at that version → abort → return false
- Otherwise, checks if the object store exists and has data (count > 0)
