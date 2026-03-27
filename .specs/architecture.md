# Tabs Outliner Revival — Architecture Overview

<purpose>
System design reference for all Tabs Outliner Revival development. Understand the layers and data flow before modifying any component.
</purpose>

<tech_stack>

### Runtime
- **Preact 10** + TypeScript 5.9 (strict mode)
- **react-arborist 3.4** — virtualized tree with built-in DnD (HTML5 backend)
- **Chrome APIs** — tabs, windows, storage, alarms, runtime, commands

### Build
- **WXT 0.20** — Vite-based web extension framework, file-based entrypoint discovery
- **Vitest 3.1** + happy-dom + @testing-library/preact + fake-indexeddb

### Scale
11 node types, 4 entrypoints, ~40 message types

</tech_stack>

<entrypoints>

### Current Entrypoints

| Entrypoint | Type | Purpose |
|------------|------|---------|
| `background` | Service worker | TreeModel owner, Chrome event handlers, persistence |
| `tree/` | Tab page | Main tree UI (react-arborist), opened via browser action |
| `options/` | Options page | Settings (4 toggles + GDrive placeholder + About) |
| `dedication/` | Unlisted page | Honoring Vladyslav Volovyk, auto-opens on first install |

**Future**: Side panel (Epic 13, post-v1). No side panel entrypoint exists today.

</entrypoints>

<layer_architecture>

### Layer Diagram

```
entrypoints/              WXT entry points (auto-discovered, generate manifest)
  background.ts             Service worker init → delegates to src/background/
  tree/                     Tree view UI → mounts App.tsx from src/view components
  options/                  Settings page
  dedication/               First-run page

src/
  background/               Service worker orchestration
    ActiveSession             Session lifecycle, Chrome event wiring
    message-handler           Dispatches view→background requests
    view-bridge               Manages connected ports, broadcasts mutations
    save-scheduler            Debounced persistence to chrome.storage.local
    event handlers            Tab/window create, update, remove, move, attach, detach

  view/                     UI layer (Preact components + hooks)
    tree-adapter              Converts NodeDTO tree to react-arborist data
    tree-actions              User interaction handlers (activate, delete, move, edit)
    hooks/
      use-port                PortManager wrapper (connect, reconnect, heartbeat)
      use-tree-data           Maintains NodeDTO tree state from background messages
      use-tree-sync           Syncs react-arborist open/close state with mutations
      use-chrome-storage      Generic chrome.storage read/write hook (used for settings)
      use-keyboard            Keyboard shortcut handlers
      use-interactions        Click, double-click, hover, context menu

  tree/                     Pure tree data model (no Chrome dependency)
    TreeModel                 Root model with O(1) indexes (node, tab, window)
    TreeNode                  Node class: id, type, parent, subnodes, data, diff IDs
    nodes/                    11 concrete node type implementations
    dto                       NodeDTO builder (computed fields: icon, tooltip, CSS, stats)
    deserialize               HierarchyJSO → TreeModel reconstruction

  serialization/            Round-trip data format
    hierarchy-jso             TreeModel ↔ flat JSON (HierarchyJSO format)
    entry-codec               Single node ↔ serialized entry
    operations-codec          Mutation operations ↔ serialized format
    knot-resolver             Base-36 diff ID encoding/decoding
    html-export               Tree → HTML for clipboard/export

  storage/                  Persistence layer
    tree-storage              Read/write tree to chrome.storage.local
    settings-storage          Read/write AppSettings
    migration                 Legacy IndexedDB (TabsOutlinerDB34) → chrome.storage

  chrome/                   Typed Chrome API wrappers
    tabs, windows, storage, runtime, lifecycle, commands, alarms
    PortManager               Client-side port with reconnection, heartbeat, message queue

  types/                    Shared type system
    messages                  Discriminated unions for all message types
    node-model                NodeDTO, NodeType, NodeMarks
    enums                     NodeTypesEnum (11 types), other enums
    brands                    Branded types (MvcId, ChromeTabId, ChromeWindowId)
    settings                  AppSettings interface
```

</layer_architecture>

<data_flow>

### Tree Mutation Flow

```
User action (click, drag, edit, keyboard shortcut)
  → View sends request2bkg_* message via port
    → Background message-handler dispatches to TreeModel
      → TreeModel mutates nodes, returns TreeMutationResult
        → save-scheduler marks dirty, debounces persistence
        → view-bridge broadcasts msg2view_notifyObserver to all connected views
          → use-tree-data applies incremental mutation to NodeDTO tree
            → react-arborist re-renders affected nodes only
```

### Chrome Event Flow

```
Chrome fires tab/window event (create, update, remove, move, attach, detach)
  → Background event handler processes event
    → TreeModel mutates: insert/update/delete/move nodes
      → Same broadcast path as user mutations above
```

### Settings Flow

```
User changes setting in options page or tree view
  → use-chrome-storage writes directly to chrome.storage.local
    → chrome.storage.onChanged fires in all contexts
      → Background reads new settings, adjusts behavior
      → Other views update via onStorageChanged listener
```

### Reconnection Flow

```
Service worker terminates (idle timeout)
  → PortManager detects disconnect
    → Queues any pending messages
    → Starts exponential backoff reconnection (1–30s)
      → On reconnect: flushes queue, PortManager fires onStateChange
        → use-port hook detects reconnection, calls onReconnect handler
          → use-tree-sync requests full tree (request2bkg_get_tree_structure)
          → Background sends msg2view_initTreeView with fresh NodeDTO root + globalViewId
            → View replaces tree, syncs react-arborist open/close state
```

</data_flow>

<message_contract>

### Background → View (`command` discriminant)

Prefixed `msg2view_`. Key messages:

| Command | Purpose |
|---------|---------|
| `msg2view_initTreeView` | Full tree + instanceId on connect/reconnect |
| `msg2view_notifyObserver` | Tree mutation (insert, delete, move, collapse, update) |
| `msg2view_notifyObserver_onNodeUpdated` | Single node data changed |
| `msg2view_setCursorHere` | Navigate cursor to a specific node |
| `msg2view_requestScrollNodeToViewInAutoscrolledViews` | Scroll a node into viewport |
| `msg2view_optionsChanged_message` | Settings changed externally |

### View → Background (`request` discriminant)

Prefixed `request2bkg_`. Key messages:

| Request | Purpose |
|---------|---------|
| `request2bkg_get_tree_structure` | Initial tree fetch |
| `request2bkg_activateNode` | Open tab/window from tree |
| `request2bkg_invertCollapsedState` | Toggle expand/collapse |
| `request2bkg_moveHierarchy` | Reorder via DnD |
| `request2bkg_deleteHierarchy` | Remove node and subtree |
| `request2bkg_onOkAfterSetNode*Text` | Commit inline edit |
| `request2bkg_create{Window,Group,Separator}` | Create new node by type |

### Contract Rules

All messages are typed as discriminated unions. Adding a new message requires updating the union type and the message handler's exhaustive switch — the compiler enforces completeness.

</message_contract>

<storage_model>

### Tree Storage

- **Key**: `tabs_outliner_tree` in `chrome.storage.local`
- **Format**: `HierarchyJSO` — flat array of serialized entries with parent references
- **Diff tracking**: Each node carries `dId`, `cdId`, `sdId` (diff IDs) encoded in base-36 for compact serialization
- **Write pattern**: `save-scheduler` debounces writes after mutation batches

### Settings Storage

- **Key**: `tabs_outliner_settings` in `chrome.storage.local`
- **Format**: `AppSettings` object (boolean toggles for UI and behavior preferences)
- **Write pattern**: Direct from view via `use-chrome-storage` hook

### Legacy Migration

- **Source**: IndexedDB `TabsOutlinerDB34` (original Tabs Outliner format)
- **Trigger**: First load detects legacy DB, auto-migrates to `chrome.storage.local`
- **One-time**: Migration runs once, then legacy DB is ignored

</storage_model>

<tree_data_model>

### TreeNode

```
TreeNode
  idMVC: MvcId              Unique per runtime (branded string, e.g. "idmvc42")
  type: NodeType             One of 11 types (see below)
  parent: TreeNode | null    Hierarchy link
  subnodes: TreeNode[]       Child nodes (ordered)
  colapsed: boolean          UI collapsed state (legacy typo — data contract)
  marks: NodeMarks           Visual customizations (relicons)
  data: unknown              Type-specific payload (TabData, WindowData, etc.)
  dId, cdId, sdId: number   Diff IDs for incremental serialization
```

### 11 Node Types

| Type | Description | Chrome Binding |
|------|-------------|----------------|
| Session | Root container for a browser session | None |
| Window | Active browser window | `chrome.windows.Window` |
| SavedWindow | Closed window (restorable) | None |
| WaitingWindow | Window pending restoration | None |
| Tab | Active open tab | `chrome.tabs.Tab` |
| SavedTab | Closed tab (restorable) | None |
| WaitingTab | Tab pending restoration | None |
| AttachWaitingTab | Intermediate restore state | None |
| Group | User-created folder | None |
| TextNote | Freeform text node | None |
| SeparatorLine | Visual divider | None |

### TreeModel Indexing

Three `Map<>` indexes for O(1) lookup:
- `nodeIndex`: `Map<string, TreeNode>` — all nodes by MVC ID
- `chromeTabIndex`: `Map<number, TreeNode>` — active tabs by Chrome tab ID
- `chromeWindowIndex`: `Map<number, TreeNode>` — active windows by Chrome window ID

</tree_data_model>

<keep_alive>

### Dual Keep-Alive Mechanism

MV3 service workers terminate after ~30s of inactivity. Two independent mechanisms prevent premature termination:

1. **PortManager heartbeat** (view connected): Sends a message every 25s over the Chrome port. Active port connections keep the service worker alive. Effective only while the tree view tab is open.

2. **chrome.alarms** (background-only): `ActiveSession` registers a recurring alarm. When it fires, the service worker wakes and can perform maintenance (save pending changes, update tab state). Effective even when no view is connected.

Both mechanisms are independent — either one alone keeps the worker alive for its scenario.

</keep_alive>

<performance_constraints>

- **Virtualized rendering**: react-arborist + react-window renders only visible nodes. DOM node count stays constant regardless of tree size.
- **Incremental mutations**: `TreeMutationResult` carries only the delta. View applies surgically — no full tree re-render.
- **Debounced persistence**: `save-scheduler` batches writes to chrome.storage. Prevents storage thrashing during rapid operations (bulk import, DnD reorder).
- **Memoized node rendering**: Node components avoid re-render when their `NodeDTO` hasn't changed.
- **Lazy entrypoints**: Options and dedication pages load independently, not bundled with the tree view.

</performance_constraints>

<security>

- **No remote code**: All code in extension package. Strict CSP, no inline scripts.
- **No data exfiltration**: No analytics, telemetry, or external network calls (except opt-in GDrive).
- **Input sanitization**: `sanitizeIconUrl()` blocks non-`img/` relative paths and localhost URLs. Node types validated on import.
- **Stale state clearing**: `active`/`focused` flags reset on all nodes at startup and shutdown — prevents accumulation regardless of code path.
- **Prompt injection defense**: Tab titles are sanitized against LLM/AI directive patterns before rendering in any context where they could be interpreted as instructions (development tooling, logs, screenshots). Angle brackets HTML-escaped, known prompt delimiters stripped.
- **Permissions**: `tabs`, `storage`, `unlimitedStorage`, `alarms`, `favicon`. Optional: `identity`, `identity.email` (GDrive), `clipboardRead`, `clipboardWrite`, `system.display`.

</security>

---

**Last Updated**: 2026-03-27
**Related**: [constitution.md](constitution.md), [../../.claude/project-summary.md](../../.claude/project-summary.md), [../../docs/modernization-plan.md](../../docs/modernization-plan.md)
