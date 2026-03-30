# 4. Tree Data Model

The tree data model is a mutable, indexed node hierarchy that represents every tab, window, group, note, and separator in the extension. It is pure TypeScript with no Chrome API dependencies. All mutations flow through `TreeModel` which maintains three O(1) indexes and emits `TreeMutationResult` for each change.

**Source files:**
- `src/tree/tree-model.ts` -- indexed tree with mutation API
- `src/tree/tree-node.ts` -- abstract base class
- `src/tree/nodes/*.ts` -- 11 concrete node types
- `src/tree/dto.ts` -- `TreeNode` -> `NodeDTO` snapshot generation
- `src/tree/deserialize.ts` -- `HierarchyJSO` -> `TreeNode` tree reconstruction
- `src/tree/mvc-id.ts` -- ephemeral ID generator
- `src/tree/types.ts` -- `TreeMutationResult`, `DiffAccumulator`, listener types
- `src/types/enums.ts` -- `NodeTypesEnum` const object
- `src/types/node-data.ts` -- per-type data shapes (`TabData`, `WindowData`, `SessionData`, etc.); Chrome types in `src/types/chrome.ts`
- `src/types/node-dto.ts` -- `NodeDTO`, `ParentUpdateData`, `StatsBlock`
- `src/types/marks.ts` -- `NodeMarks`
- `src/types/brands.ts` -- branded types (`MvcId`, `DiffId`, etc.)
- `src/types/serialized.ts` -- `SerializedNode`, `HierarchyJSO`

---

## 4.1 TreeModel

See `src/tree/tree-model.ts` for the full mutation API (insertSubnode, removeSubtree, moveNode, replaceNode, setCollapsed, setMarks, etc.) and static factories (fromHierarchyJSO, createEmpty).

### Three Indexes

| Index | Type | Key | Value | Indexed Node Types |
|-------|------|-----|-------|--------------------|
| `nodeIndex` | `Map<string, TreeNode>` | `node.idMVC` (MvcId string) | TreeNode | ALL nodes |
| `chromeTabIndex` | `Map<number, TreeNode>` | Chrome tab ID (`data.id`) | TreeNode | TAB, ATTACHWAITINGTAB |
| `chromeWindowIndex` | `Map<number, TreeNode>` | Chrome window ID (`data.id`) | TreeNode | WINDOW only |

Indexes are updated incrementally on every mutation: `indexNode()`/`unindexNode()` for single nodes, `indexSubtree()`/`unindexSubtree()` for subtrees. On construction, `rebuildIndices()` walks the full tree.

**O(1) lookups enabled:** `findByMvcId(id)` -> nodeIndex, `findActiveTab(tabId)` -> chromeTabIndex, `findActiveWindow(windowId)` -> chromeWindowIndex.

### TreeMutationResult

Every mutation method returns this, and optionally emits to the `onMutation` listener:

```typescript
interface TreeMutationResult {
  readonly type: 'insert' | 'delete' | 'move' | 'collapse' | 'update' | 'replace';
  readonly affectedNodeId: MvcId;
  readonly parentUpdates: ParentsUpdateData;  // Record<string, ParentUpdateData> keyed by idMVC
  readonly deletedNodeIds?: MvcId[];          // Present on 'delete' type
  readonly cursorSuggestion?: MvcId;          // Present on 'delete' and 'replace' types
}
```

**How parentUpdates drives incremental view updates:** `buildResult()` walks from the affected parent to root, computing for each ancestor a `ParentUpdateData` snapshot (isSubnodesPresent, isCollapsed, subnodesStatBlock, isProtectedFromGoneOnClose, CSS classes, selection/focus state). The view applies only the deltas described by `parentUpdates` rather than re-rendering the full tree.

**Mutation side effects:** All mutations that add nodes call `node.resetStructureDidsRecursive()` first and `invalidateAncestors(parent)` after. All mutations that change tree structure call `parent.calculateIsProtectedFromGoneOnClose()`.

---

## 4.2 TreeNode (Abstract Base Class)

See `src/tree/tree-node.ts` for the full class. Key method categories:

- **Identity:** `idMVC`, `previousIdMVC`, `type` (abstract discriminant)
- **Hierarchy:** `parent`, `subnodes`, `insertSubnode()`, `removeFromParent()`, `findLastDescendant()`
- **Navigation:** `findPrevVisible()`, `findNextVisible()` (respect collapsed state), `getPathToRoot()` (unconditional walk to root)
- **Display:** abstract `getIcon()`, `getNodeText()`, `titleCssClass`, `titleBackgroundCssClass`, `isLink`, `getHref()`
- **Marks:** `setMarks()`, `copyMarksAndCollapsedFrom()`, `isCustomMarksPresent()`
- **Stats:** `countSubnodesStats()` returns `{ nodesCount, activeWinsCount, activeTabsCount }` via recursive walk
- **Query:** `isAnOpenTab()`, `isAnOpenWindow()`, `isSelectedTab()`, `isFocusedWindow()`, `isProtectedFromGoneOnClose()`
- **Serialization:** `serialize()`, `serializeToHierarchy()`, abstract `serializeData()`, abstract `cloneAsSaved()`

### Diff Tracking Fields

| Field | Default | Purpose |
|-------|---------|---------|
| `dId` | `0` | Node difference ID -- tracks structural changes |
| `cdId` | `0` | Content difference ID -- tracks data changes |
| `sdId` | `0` | Subnodes difference ID -- tracks child list changes |
| `sdIdKnot` | `null` | Serialized knot with dId == sdId, base for subnodes diff |

A value of `0` means "needs allocation" -- the diff serializer assigns a real ID on next serialize pass. `invalidateDids()` resets all to 0 (forcing reallocation). `resetStructureDidsRecursive()` does the same for entire subtrees. This ensures that moved/inserted nodes always get fresh diff IDs.

### Protection Logic

A node is protected from removal on close if it has custom marks OR if any direct child is not an unmarked active tab (i.e., has children, marks, or is a non-TAB type). Overridden by Tab, AttachWaitTab, and Window types. Cached in `isProtectedFromGoneOnCloseCache`, recalculated on structural mutations.

---

## 4.3 All 11 Node Types

See `src/tree/nodes/` for individual implementations and `diagrams/node-type-hierarchy.d2` for the visual hierarchy and conversion arrows.

| Type String | Class | CSS Class | Background | isLink | Data Shape | Notable |
|-------------|-------|-----------|------------|--------|------------|---------|
| `'session'` | `SessionTreeNode` | `session` | `windowFrame` | no | `SessionData` | Root node; `allocateDId()`/`peekNextDId()` for diff; clones as Group |
| `'tab'` | `TabTreeNode` | `tab` | `tabFrame` | yes | `TabData` | `restoredFromSaved` flag; `updateChromeData()`; indexed in chromeTabIndex |
| `'savedtab'` | `SavedTabTreeNode` | `savedtab` | `tabFrame` | yes | `TabData` | Type OMITTED in serialization (default); replaces `status:'loading'` with `'complete'`, deletes `windowId` |
| `'waitingtab'` | `WaitingTabTreeNode` | `waitingtab` | `tabFrame` | yes | `TabData` | Legacy -- deserialization only |
| `'attachwaitingtab'` | `AttachWaitTabTreeNode` | `attachwaitingtab` | `tabFrame` | yes | `TabData` | Like TabTreeNode; indexed in chromeTabIndex |
| `'win'` | `WindowTreeNode` | `win` | `windowFrame` | no | `WindowData` | `updateChromeData()`; indexed in chromeWindowIndex |
| `'savedwin'` | `SavedWindowTreeNode` | `savedwin` | `windowFrame` | no | `WindowData` | Shows close/crash dates in text |
| `'waitingwin'` | `WaitingWindowTreeNode` | `waitingwin` | `windowFrame` | no | `WindowData` | Legacy -- deserialization only |
| `'group'` | `GroupTreeNode` | `group` | `windowFrame` | no | `null` | Container with custom title |
| `'textnote'` | `TextNoteTreeNode` | `textnote` | `defaultFrame` | no | `TextNoteData` | `setNote()`; defaults to `'#'` |
| `'separatorline'` | `SeparatorTreeNode` | `separatorline` | `defaultFrame` | no | `SeparatorData` | 3 styles cycled via `cycleStyle()` (index 0/1/2) |

See `src/types/node-data.ts` for data shape interfaces (`TabData`, `WindowData`, `SessionData`, `TextNoteData`, `SeparatorData`). The underlying Chrome types (`ChromeTabData`, `ChromeWindowData`) are in `src/types/chrome.ts`.

---

## 4.4 cloneAsSaved() Conversion Table

| Source Type | Target Type | Notes |
|-------------|-------------|-------|
| `TabTreeNode` | `SavedTabTreeNode` | `active` set to `false` |
| `SavedTabTreeNode` | `SavedTabTreeNode` | Identity clone |
| `WaitingTabTreeNode` | `SavedTabTreeNode` | -- |
| `AttachWaitTabTreeNode` | `SavedTabTreeNode` | -- |
| `WindowTreeNode` | `SavedWindowTreeNode` | -- |
| `SavedWindowTreeNode` | `SavedWindowTreeNode` | Identity clone |
| `WaitingWindowTreeNode` | `SavedWindowTreeNode` | -- |
| `SessionTreeNode` | `GroupTreeNode` | `marks.customTitle` set to `'Tree'` |
| `GroupTreeNode` | `GroupTreeNode` | Identity clone |
| `TextNoteTreeNode` | `TextNoteTreeNode` | Identity clone |
| `SeparatorTreeNode` | `SeparatorTreeNode` | Identity clone |

All clones get a fresh `idMVC` (from the constructor). Marks and collapsed state are copied via `copyMarksAndCollapsedFrom()`.

---

## 4.5 NodeDTO and Sanitization

Plain-object snapshot sent from background to view. Generated by `toNodeDTO(node)` in `src/tree/dto.ts`. See `src/types/node-dto.ts` for the full `NodeDTO`, `ParentUpdateData`, and `StatsBlock` interfaces.

### Sanitization Rules

**`sanitizeIconUrl()`** allows: `img/*` (own assets), `https://*`, `http://*` (excluding localhost), `data:image/*`. Blocks everything else (chrome-extension://, legacy paths like `public/build/img/`).

**`sanitizeHref()`** allows: `https://`, `http://`, `chrome://`, `edge://`, `about:`. Blocks `javascript:`, `data:`, `blob:`.

---

## 4.6 MvcId

**File:** `src/tree/mvc-id.ts`

**Generation strategy:** `"idmvc"` prefix + monotonically increasing integer counter. Example: `"idmvc1"`, `"idmvc2"`, ..., `"idmvc999"`.

**Ephemeral nature:** MvcIds are NOT persisted. They exist only for the lifetime of a service worker session. When the service worker restarts, the counter resets and all nodes get new MvcIds. Views receive new IDs via `msg2view_initTreeView`. The `previousIdMVC` field on replaced nodes lets the view map old IDs to new ones during transitions.

---

## 4.7 Diff Tracking

The diff system enables incremental serialization (only changed nodes are re-serialized). Three IDs per node (`dId`, `cdId`, `sdId`) track whether the node's structure, content, or child list has changed since the last serialization pass.

- **`dId`** (node difference ID): Allocated on first serialize. Reset to 0 on any structural change (move, insert, remove). When 0, the serializer allocates a new ID via `root.allocateDId()`.
- **`cdId`** (content difference ID): Tracks data changes. Reset when node data changes.
- **`sdId`** (subnodes difference ID): Tracks child list changes. Reset when children are added/removed/reordered.
- **`sdIdKnot`**: Cached serialized knot string for the subnodes list at the point when `sdId` was assigned. Used as the diff base -- if the knot hasn't changed, subnodes don't need re-serialization.

See `src/tree/types.ts` for `DiffAccumulator` shape and `src/tree/tree-node.ts:serializeForDiff()` for the allocation logic.

---

## 4.8 Deserialization

See `src/tree/deserialize.ts`. `restoreTree(jso)` recursively reconstructs the tree from `HierarchyJSO`. `deserializeNode(raw)` handles legacy field normalization and type dispatch.

**Key gotcha:** When `type` is omitted from `SerializedNode`, it defaults to `savedtab` (the most common persisted type -- this saves significant storage space).

---

## 4.9 Serialized Wire Formats

See Section 5 (Serialization) for the authoritative definitions of `SerializedNode`, `HierarchyJSO`, and `DiffAccumulator`. Cross-reference: `src/types/serialized.ts`.

---

## 4.10 NodeTypesEnum

Defined in `src/types/enums.ts` as a `const` object (not a TS enum). The union type `NodeType` is derived from it.

**Legacy contract:** `NODE_TYPE_NUM2STR` provides index-to-string mapping for serialization. Index order is a contract with existing IndexedDB data and cannot be changed. Index 0 is reserved (`'ZERO'`) because collapsed state was encoded as negative type index in the legacy format.
