# Tabs Outliner Revival — Comprehensive Architecture Document

> **Last Updated**: 2026-03-27
> **Audience**: Claude Code (AI agent) — optimized for AI context loading
> **Authority**: `.specs/constitution.md` > this document > `.claude/project-summary.md`

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Background Service Worker](#3-background-service-worker)
4. [Tree Data Model](#4-tree-data-model)
5. [Serialization & Storage](#5-serialization--storage)
6. [View Layer](#6-view-layer)
7. [Chrome API Wrappers](#7-chrome-api-wrappers)
8. [Message Contract Reference](#8-message-contract-reference)
9. [Data Flow Traces](#9-data-flow-traces)
10. [Configuration & Build](#10-configuration--build)
11. [Test Infrastructure](#11-test-infrastructure)
12. [Modernization Plan Divergences](#12-modernization-plan-divergences)
13. [Suggested Screenshots](#13-suggested-screenshots)

## Diagrams

All diagrams are in `diagrams/` as D2 source + compiled SVG:
- `system-layers` — Module dependency graph
- `port-manager-state` — PortManager state machine
- `tree-mutation-flow` — User action → mutation → render pipeline
- `chrome-event-flow` — Chrome API event → tree update pipeline
- `reconnection-flow` — Service worker restart recovery
- `save-scheduler` — Debounce + max-wait timing
- `node-type-hierarchy` — 11 node types by category
- `serialization-pipeline` — Data format transformation chain

---

# 1. Executive Summary

## What Tabs Outliner Revival Does

Tabs Outliner Revival is a Chrome extension that captures every browser window, tab, group, note, and separator into a persistent, hierarchical tree. When a user closes a window or tab, the tree converts active nodes to saved equivalents rather than deleting them, preserving the user's browsing workspace across sessions, crashes, and restarts. The extension is a ground-up reimplementation of the original Tabs Outliner (by Vladyslav Volovyk) using modern Manifest V3 tooling, with full backward compatibility for existing user data.

## Key Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI framework | **Preact 10** (not React) | ~3 KB gzipped vs ~42 KB. `preact/compat` shim provides React API compatibility for react-arborist. No concurrent rendering needed. |
| Extension framework | **WXT 0.20** (not Plasmo, not CRXJS) | Vite-based, fast HMR, file-based entrypoint discovery, first-class MV3 support. Actively maintained. |
| Tree rendering | **react-arborist 3.4** | Virtualized rendering (only visible nodes in DOM), built-in DnD, keyboard navigation, custom node renderers. Handles 1000+ nodes smoothly. |
| State management | **useReducer + refs** (not Zustand, not signals) | Background-owns-state architecture made external state management unnecessary. See Section 12.1 for full rationale. |
| Serialization format | **HierarchyJSO** (JSON in chrome.storage.local) | Replaced legacy IndexedDB. Simple, inspectable, backs up with the Chrome profile. `unlimitedStorage` permission removes size limits. |
| Testing | **Vitest 3.1** + happy-dom + fakeBrowser | Vite-native test runner. WXT's `fakeBrowser` provides in-memory Chrome API stubs. happy-dom is faster than jsdom. |

## Current Status

**Version**: 2.0.0-beta.1 (heading toward beta.2, then rc.0, then v1 ship as 2.0.0)

**Remaining for v1**: Add Note hover action, tab note display format, critical bug fixes (beta.2), visual polish pass (rc.0), smoke test execution. **Post-v1**: Epic 10 (Google Drive backup), Epic 13 (side panel), Epic 14 (Playwright E2E).

See `.specs/architecture.md` for core architectural pattern, guiding principles, and entrypoint descriptions.

---

# 2. System Architecture Overview

See `.specs/architecture.md` for source layout, layer descriptions, and entrypoint descriptions.

---

## 2.1 Dependency Rules

Layers follow strict dependency rules. Arrows indicate "depends on" (can import from):

| Layer | Can Import From | Cannot Import From |
|-------|----------------|-------------------|
| **Entrypoints** | background, view, chrome, types | (delegates only) |
| **Background** | tree, serialization, storage, chrome, types | view |
| **View** | tree (types only, via `NodeDTO`), chrome (`PortManager`), types | background, serialization, storage |
| **Tree** | types | chrome, serialization, storage, background, view |
| **Serialization** | types | chrome, tree, storage, background, view |
| **Storage** | chrome, serialization, types | tree, background, view |
| **Chrome** | types | tree, serialization, storage, background, view |
| **Types** | (none -- leaf layer) | everything |

Key invariants:

- **Tree and Serialization are pure**: Zero Chrome API dependency. Fully testable with plain unit tests.
- **View never imports from Background**: Communication exclusively through Chrome ports with typed messages.
- **Background never imports from View**: Broadcasts via `ViewBridge` with no knowledge of Preact components.

See `diagrams/system-layers.d2` for the visual representation.

---

## 2.2 Module Boundary Rules

1. **Entrypoints delegate to `src/`**: Entry files contain only WXT boilerplate. All logic lives in `src/`.
2. **No shared code in `entrypoints/`**: Shared code goes in `src/`.
3. **Barrel exports**: `src/chrome/index.ts` re-exports all Chrome wrappers. Import from `@/chrome`.
4. **`@/` path alias**: Resolves to `src/` (see Section 10.2 for resolution details).
5. **Type-only imports across layer boundaries**: View imports tree types (`NodeDTO`, `NodeType`, `MvcId`) but never tree runtime code (`TreeModel`, `TreeNode`).

---

# 3. Background Service Worker

The background service worker is the single source of truth for the tree. It owns the `TreeModel`, reacts to Chrome tab/window events, handles messages from view ports, and persists changes via a debounced save scheduler. All tree mutations flow through here; the view is a read-only projection.

**Source files:**
- `src/background/active-session.ts` -- orchestrator
- `src/background/chrome-event-handlers.ts` -- Chrome event listeners
- `src/background/message-handlers.ts` -- view-to-background message dispatch
- `src/background/view-bridge.ts` -- port management and broadcast
- `src/background/save-scheduler.ts` -- debounced persistence
- `src/background/badge-manager.ts` -- extension icon badge
- `src/background/crash-recovery.ts` -- startup Chrome state reconciliation
- `src/tree/close-tracker.ts` -- recently closed tab buffer (lives in `src/tree/`, not `src/background/`)

---

## 3.1 ActiveSession

The top-level orchestrator. Owns all subsystems and exposes the public API for tree operations. See `src/background/active-session.ts` for the full public API (getInitMessage, importTree, exportTree, scheduleSave, saveNow, dispose).

### Static Factory: `create()` — Initialization Sequence

**This 7-step startup order is critical and must not be reordered:**

1. **Load tree from storage:**
   - Call `treeExists()`. If true, call `loadTree()` and construct via `TreeModel.fromHierarchyJSO(jso)`.
   - If no tree exists, check `isMigrationNeeded()` for legacy IndexedDB data. If migration succeeds and produces nodes, load the migrated tree.
   - Fallback: `TreeModel.createEmpty()` (creates a root `SessionTreeNode`).

2. **Construct `ActiveSession`** with the loaded tree model.

3. **Crash recovery:** Call `synchronizeTreeWithChrome(treeModel)`.
   - Converts orphaned active nodes (Chrome entity gone) to saved equivalents.
   - Creates new nodes for Chrome windows/tabs not yet in the tree.
   - Removes extension's own tab nodes that leaked into the tree.
   - If any changes occurred (`recoveredCount > 0 || newCount > 0 || cleanedCount > 0`), saves immediately.

4. **Register Chrome event handlers:** `registerChromeEventHandlers(session, session.viewBridge)` -- returns a cleanup function stored in `_cleanupChromeEvents`.

5. **Start keep-alive alarm:** `createAlarm('tabs-outliner-keep-alive', 25 / 60)` (~0.4167 minutes = 25 seconds). The alarm callback is a no-op; its sole purpose is to prevent the service worker from being terminated by Chrome's 30-second idle timeout.

6. **Initial badge update:** `updateBadge(treeModel)`.

7. **Return** the fully initialized session.

### Import Deactivation

The `deactivateHierarchy()` helper walks a HierarchyJSO tree in-place and:
- Converts active type strings to saved equivalents: `tab`->`savedtab`, `win`->`savedwin`, `waitingtab`->`savedtab`, `attachwaitingtab`->`savedtab`, `waitingwin`->`savedwin`
- Clears `data.active` and `data.focused` on ALL nodes (even those already saved)
- Strips invalid favicon URLs (non-https/http/data:image)
- Deletes `data.id` and `data.windowId` (Chrome runtime IDs meaningless after import)

---

## 3.2 Chrome Event Handlers

Registered by `registerChromeEventHandlers(session, bridge)`. Returns a cleanup function that removes all listeners. See `src/background/chrome-event-handlers.ts` for step-by-step behavior of each handler.

There are **11 registered handlers** (12 Chrome event registrations, but `onTabDetached` is a deliberate no-op):

| Handler | Chrome Event | Purpose |
|---------|-------------|---------|
| `handleTabCreated` | `tabs.onCreated` | Create node for new tab; undo-close position restoration |
| `handleTabRemoved` | `tabs.onRemoved` | Track close, convert-or-remove based on protection |
| `handleTabUpdated` | `tabs.onUpdated` | Update chrome data; remove if navigated to extension URL |
| `handleTabMoved` | `tabs.onMoved` | Reorder node within same window (**gotcha**: uses direct `removeFromParent()`+`insertSubnode()`, not `TreeModel.moveNode()`) |
| `handleTabAttached` | `tabs.onAttached` | Move node to new window (second half of detach+attach) |
| (no-op) | `tabs.onDetached` | Intentional no-op; `onAttached` handles full move |
| `handleTabActivated` | `tabs.onActivated` | Toggle `active` flag among window's tab children |
| `handleTabReplaced` | `tabs.onReplaced` | Re-index node when Chrome replaces tab ID |
| `handleWindowCreated` | `windows.onCreated` | Create window node (skips DevTools/panel) |
| `handleWindowRemoved` | `windows.onRemoved` | Convert window + all children to saved |
| `handleWindowFocusChanged` | `windows.onFocusChanged` | Update focused state (100ms debounce) |

### Protection Logic (handleTabRemoved)

When a tab closes (`handleTabRemoved`), the handler decides whether to **convert** (preserve in tree as saved) or **remove** (delete subtree):

- **Convert to saved** if: tab has custom marks, has children, OR was `restoredFromSaved`. Creates `SavedTabTreeNode`, copies marks/collapsed, broadcasts `onNodeReplaced`.
- **Remove entirely** if: none of the above. Broadcasts `onNodeRemoved`. Calls `removeEmptyWindowParent()` to clean up empty unmarked parent windows.
- **Skip entirely** if: `removeInfo.isWindowClosing` is true (the `handleWindowRemoved` handler owns conversion of the entire window subtree).

The `closeTracker.track(node)` call happens BEFORE detach (reads parent/sibling index while still valid).

### Helper: `removeEmptyWindowParent()`

Exported function used by both chrome-event-handlers and message-handlers. Removes a WINDOW or SAVEDWINDOW parent that has become empty (`subnodes.length === 0`) and has no custom marks.

---

## 3.3 Message Handlers

Entry point: `handleViewMessage(msg, port, session, bridge)`. Dispatches on `msg.request` via a switch statement. See `src/background/message-handlers.ts` for full implementation details.

| Message (`request` field) | Handler | Purpose |
|---------------------------|---------|---------|
| `request2bkg_get_tree_structure` | `handleGetTreeStructure` | Send full tree init to requesting port |
| `request2bkg_activateNode` | `handleActivateNode` | Activate tab/window or restore savedtab |
| `request2bkg_invertCollapsedState` | `handleInvertCollapsedState` | Toggle collapsed state |
| `request2bkg_activateHoveringMenuActionOnNode` | `handleHoveringMenuAction` | Dispatch menu action (close/delete/cursor/edit) |
| `request2bkg_onViewWindowBeforeUnload_saveNow` | (inline) | Force immediate save |
| `request2bkg_focusTab` | (inline) | Focus a Chrome tab |
| `request2bkg_import_tree` | (async) | Import tree JSON, broadcast new state |
| `request2bkg_export_tree` | (inline) | Export tree as JSON or HTML |
| `request2bkg_moveHierarchy` | `handleMoveHierarchy` | Move subtree; auto-wrap tabs at root |
| `request2bkg_onOkAfterSetNodeTabTextPrompt` | `handleApplyNodeTabText` | Set custom title on tab |
| `request2bkg_onOkAfterSetNodeNoteTextPrompt` | `handleApplyNodeNoteText` | Set note text |
| `request2bkg_onOkAfterSetNodeWindowTextPrompt` | `handleApplyNodeWindowText` | Set custom title on window |
| `request2bkg_copyHierarchy` | `handleCopyHierarchy` | Deep-clone subtree (active->saved) |
| `request2bkg_createWindow` | `handleCreateNode('window')` | Create SavedWindow after cursor |
| `request2bkg_createGroup` | `handleCreateNode('group')` | Create Group after cursor |
| `request2bkg_createSeparator` | `handleCreateNode('separator')` | Create Separator after cursor |

### handleActivateNode — Savedtab Restoration Flow

The most complex handler. When activating a SAVEDTAB node:
1. Validates URL is http/https only.
2. **Walks ancestor chain** to find the nearest suitable ancestor — handles three types: `WINDOW` (use Chrome window ID), `TAB` (use its `windowId`), and `SAVEDWINDOW` (verify window still exists, check for sibling tabs).
3. If an active window ancestor found: creates tab in that window via `chrome.tabs.create({windowId, url})`.
4. If no active window ancestor: creates a new Chrome window via `chrome.windows.create({url})`.
5. Waits for the `onTabCreated` Chrome event to fire (which creates a duplicate TabTreeNode).
6. Removes the duplicate node created by `onTabCreated`.
7. Replaces the saved node with an active `TabTreeNode` (sets `restoredFromSaved = true`).
8. Broadcasts `onNodeReplaced`.

### Hovering Menu Actions

Dispatched by `handleHoveringMenuAction` after validating `actionId` against `ALLOWED_ACTIONS` set. See `src/background/message-handlers.ts` for per-action behavior (closeAction, deleteAction, setCursorAction, editTitleAction).

---

## 3.4 ViewBridge

Simple Set-based port manager for background-to-view communication. See `src/background/view-bridge.ts` for API. Manages `Set<Port>`, auto-removes on disconnect, removes dead ports on broadcast errors.

---

## 3.5 SaveScheduler

Debounced persistence scheduler with dirty-while-saving protection. See `src/background/save-scheduler.ts` for the class API.

### State Machine

**States:**
- **Idle:** No timers active, not saving.
- **Debouncing:** Debounce timer running. Each `schedule()` call resets the debounce timer. Max-wait timer started on first `schedule()` call in a batch.
- **Saving:** `_saveFn()` executing. `_saving = true`.
- **Dirty-while-saving:** A `schedule()` call or `_executeSave()` was invoked while `_saving === true`. Sets `_dirtyWhileSaving = true`.

**Transitions:**

1. `Idle` --[`schedule()`]--> `Debouncing`: Starts debounce timer (3s) and max-wait timer (8s).
2. `Debouncing` --[`schedule()`]--> `Debouncing`: Resets debounce timer. Max-wait timer unchanged.
3. `Debouncing` --[debounce fires OR max-wait fires]--> `Saving`: Clears all timers, calls `_executeSave()`.
4. `Saving` --[`_saveFn()` resolves, `_dirtyWhileSaving === false`]--> `Idle`.
5. `Saving` --[`_executeSave()` called while saving]--> `Dirty-while-saving`: Sets `_dirtyWhileSaving = true`, returns immediately.
6. `Saving` --[`_saveFn()` resolves, `_dirtyWhileSaving === true`]--> `Saving`: Clears flag, calls `_executeSave()` again.
7. Any --[`saveNow()`]--> `Saving`: Clears all timers, calls `_executeSave()` synchronously (awaited).
8. Any --[`cancel()`]--> `Idle`: Clears all timers without saving.

**Max-wait behavior:** When the max-wait timer fires, it cancels any pending debounce timer and triggers `_executeSave()` directly. This guarantees a save within 8s even under sustained rapid mutations.

See `diagrams/save-scheduler.d2` for the visual state machine.

---

## 3.6 BadgeManager

Displays active tab count on the extension icon badge. See `src/background/badge-manager.ts`. Called at end of `ActiveSession.create()` (initial) and inside `ActiveSession.scheduleSave()` (on every tree mutation).

---

## 3.7 CloseTracker

Lives in `src/tree/close-tracker.ts`. Tracks recently closed tabs for undo-close (Ctrl+Shift+T) detection.

### Undo-Close Detection Pattern

**Recording (on tab close):** `handleTabRemoved` calls `closeTracker.track(node)` BEFORE the node is detached from its parent. This captures `parentMvcId` and `siblingIndex` while the tree structure is still intact. Records are stored in an array-backed buffer (max 50 entries, FIFO eviction).

**Matching (on tab create):** `handleTabCreated` calls `closeTracker.findByUrl(tab.url)` to detect if a newly created tab matches a recently closed one. Search iterates newest-first (end to start). If a match is found AND the original parent still exists in the tree, the new tab node is inserted at the recorded sibling index (clamped to bounds) instead of appending as the last child.

**CloseRecord shape:**
```typescript
interface CloseRecord {
  readonly tabData: TabData;
  readonly parentMvcId: MvcId;
  readonly siblingIndex: number;
  readonly timestamp: number;
}
```

---

## 3.8 Crash Recovery

Lives in `src/background/crash-recovery.ts`. Called during `ActiveSession.create()` and after `importTree()`.

### 3-Phase Reconciliation

```typescript
async function synchronizeTreeWithChrome(model: TreeModel): Promise<RecoveryResult>
// RecoveryResult: { recoveredCount: number, newCount: number, cleanedCount: number }
```

1. **Query Chrome state:** `queryWindows()` and `queryTabs({})` in parallel. Build `liveWindowIds` and `liveTabIds` sets.

2. **Phase 1 -- Convert orphaned active nodes to saved:**
   - Active WINDOW nodes whose `data.id` is not in `liveWindowIds` -> replaced with `SavedWindowTreeNode({...data, crashDetectedDate: Date.now()})`.
   - Active TAB nodes whose `data.id` is not in `liveTabIds` -> replaced with `SavedTabTreeNode(data)`.

3. **Phase 1b -- Remove extension's own tab nodes:**
   - Finds TAB or SAVEDTAB nodes where `data.url` matches `isExtensionUrl()`.
   - Re-parents their children to the node's parent before removing (preserves user data under extension tabs).

4. **Phase 2 -- Create nodes for new Chrome entities:**
   - Builds sets of window/tab IDs already in the tree.
   - Groups new Chrome tabs by window ID.
   - For each Chrome window not in the tree (and that has non-extension tabs): creates a `WindowTreeNode` + child `TabTreeNode`s.
   - For each Chrome window already in the tree: adds any new tabs as children.
   - Skips windows with zero user-facing tabs (DevTools, extension popups).

---

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

---

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

---

# 6. View Layer

## 6.1 Entrypoints Overview

| Entrypoint | Path | Purpose |
|------------|------|---------|
| Tree View | `entrypoints/tree/` | Primary UI -- the tree sidebar panel |
| Options | `entrypoints/options/` | Settings page (opened in a popup window) |
| Dedication | `entrypoints/dedication/` | Attribution page for the original developer |

---

## 6.2 Tree View: App.tsx

File: `entrypoints/tree/App.tsx`

Main component that composes all hooks and renders the tree. See source for the full render structure and react-arborist `<Tree>` configuration props.

### Hook Composition Order

The hooks are instantiated in this exact order (dependencies flow top-to-bottom):

```
1. treeRef            = useRef<TreeApi<NodeDTO>>()
2. treeContainerRef   = useRef<HTMLDivElement>()
3. { state, isLoading, handleMessage, clearExport, clearExportHtml, clearEditing }
                      = useTreeData()
4. { height }         = useWindowSize()
5. onReconnect        = useCallback(() => postMessage(requestTree()))
6. { postMessage, connectionState }
                      = usePort(handleMessage, onReconnect)
7. clipboard          = useClipboard({ postMessage })
8. { contextMenuState, openContextMenu, closeContextMenu }
                      = useContextMenu()
9. { onToggle, onActivate }
                      = useTreeSync({ treeRef, root, globalViewId, needsFullRefresh, postMessage })
10. { hoverState, clearHover, handleAction, ctxValue, lastKeyboardTargetId, localCursorId }
                      = useTreeInteractions({ postMessage, treeContainerRef, selectedId, editingNode, clearEditing, onOpenContextMenu, hasClipboard })
11. useKeyboardShortcuts({ treeRef, postMessage, selectedId: localCursorId, lastKeyboardTargetId, editingId, clipboard, closeContextMenu, contextMenuOpen })
12. handleTreeMove    = useCallback (react-arborist onMove handler)
13. scrollPadding     = useState + useEffect (ResizeObserver on treeContainerRef)
14. { showFirstRun, dismissFirstRun, isExternalDragOver, handleTreeDragOver, handleTreeDragLeave, handleTreeDrop, handleImport }
                      = useTreeDrop({ postMessage, importResult, exportJson, exportHtml, clearExport, clearExportHtml })
```

---

## 6.3 Hook Dependency Map

```
usePort
  ├─ deps: onMessage callback, onReconnect callback
  ├─ internal: PortManager, hasConnectedRef
  └─ returns: { postMessage, connectionState, isConnected }

useTreeData
  ├─ deps: none (self-contained reducer)
  ├─ internal: indexesRef (nodeIndex, parentIndex), useReducer
  └─ returns: { state: TreeState, isLoading, handleMessage, clearExport, clearExportHtml, clearEditing }

useWindowSize
  ├─ deps: none
  └─ returns: { width, height }

useTreeSync
  ├─ deps: treeRef, root, globalViewId, needsFullRefresh, postMessage
  ├─ internal: isSyncingRef, prevOpenMapRef, prevViewIdRef
  └─ returns: { onToggle, onActivate }

useTreeInteractions
  ├─ deps: postMessage, treeContainerRef, selectedId, editingNode, clearEditing, onOpenContextMenu, hasClipboard
  ├─ internal: lastKeyboardTargetId ref, localCursorId state, hoverState, singleClickActivation
  └─ returns: { hoverState, clearHover, handleAction, ctxValue, lastKeyboardTargetId, localCursorId }

useKeyboardShortcuts
  ├─ deps: treeRef, postMessage, selectedId, lastKeyboardTargetId, editingId, clipboard, closeContextMenu
  ├─ internal: moveCooldownUntil
  └─ returns: void (side-effect only: document keydown listener)

useClipboard
  ├─ deps: postMessage
  ├─ internal: entryRef (ClipboardEntry), hasClipboard state
  └─ returns: { cut, copy, paste, hasClipboard, clearClipboard }

useChromeStorage
  ├─ deps: area, key, defaultValue
  └─ returns: [value, setValue]

useContextMenu
  ├─ deps: none
  └─ returns: { contextMenuState, openContextMenu, closeContextMenu }

useTreeDrop
  ├─ deps: postMessage, importResult, exportJson, exportHtml, clearExport, clearExportHtml
  ├─ internal: showFirstRun state, isExternalDragOver state
  └─ returns: { showFirstRun, dismissFirstRun, isExternalDragOver, handleTreeDragOver, handleTreeDragLeave, handleTreeDrop, handleImport }
```

---

## 6.4 usePort

File: `src/view/hooks/use-port.ts`

Wraps `PortManager` lifecycle for the tree view. Creates a long-lived `'tree-view'` port connection to the background service worker. See section 7 (PortManager) for the connection/reconnection protocol. Tracks reconnections via `hasConnectedRef` to re-request full tree on reconnect.

---

## 6.5 useTreeData

File: `src/view/hooks/use-tree-data.ts`

Self-contained reducer managing tree state, indexes, and transient UI state (editing, exports, import results). See source for `TreeState` fields and reducer action types.

### clonePathToRoot Pattern

The immutable update strategy for incremental patches:

1. Walk `parentIndex` from target node up to root, collecting the path of idMVCs
2. Clone bottom-up: for each node in the path, create a new object with updated `subnodes` array
3. The replacement parameter determines behavior:
   - `NodeDTO`: replace the target node at its position in parent's subnodes
   - `null`: filter the target node out of parent's subnodes (removal)
4. `isSubnodesPresent` is recomputed on each cloned parent so expand/collapse arrows update correctly
5. Returns new root, or null if path is broken (triggers full refresh)

### NODE_UPDATED Subnodes Merge Logic

When handling `NODE_UPDATED`, subnodes are resolved as:
- If update has `subnodes.length > 0` → use the update's subnodes (expand sends children)
- Else if `isSubnodesPresent: true` → preserve existing subnodes (node is collapsed, children are hidden but still exist)
- Else → empty array (true leaf node)

Additionally, if the updated node is the node currently being edited (`state.editingNode?.idMVC === action.idMVC`), the editing state is cleared in the same render to avoid a flash of old text.

---

## 6.6 useTreeSync

File: `src/view/hooks/use-tree-sync.ts`

Manages react-arborist open/close sync with background tree state, mount/refresh lifecycle, and unload notification.

### globalViewId Change Detection

Tracks `prevViewIdRef`. When `globalViewId !== prevViewIdRef.current`, it's a full tree replacement (import, reconnect) -- do a full sync of all open/close states. Otherwise, incremental sync: only apply differences between previous and current open maps.

### isSyncingRef Suppression

During programmatic open/close calls (`tree.open(id)` / `tree.close(id)`), react-arborist fires `onToggle` callbacks. The `isSyncingRef` flag suppresses these so the view doesn't echo toggle requests back to the background.

---

## 6.7 useTreeInteractions

File: `src/view/hooks/use-tree-interactions.ts`

### Dual Cursor System

Two separate cursor concepts:

| Cursor | Type | Updated By | Purpose |
|--------|------|-----------|---------|
| `localCursorId` | `useState<string \| null>` | Click, backend `setCursorHere` | Visual highlight (CSS class `cursor-node`), react-arborist `selection` prop |
| `lastKeyboardTargetId` | `useRef<string \| null>` | Click, action dispatch, context menu open | Stable target for keyboard shortcuts and toolbar create operations |

**Hover does NOT update either cursor.** The mouse position changes constantly; keyboard shortcuts must target the last deliberately-interacted node.

Backend sync: when `selectedId` (from `SET_CURSOR` action) changes and is non-null, both `localCursorId` state and `lastKeyboardTargetId` ref are updated. Uses the "update during render" pattern for state (avoiding cascading useEffect renders) and useEffect for the ref write.

See source for `HoverState`, `TreeContextValue`, activation mode (`singleClickActivation`), and inline edit handling.

---

## 6.8 useKeyboardShortcuts

File: `src/view/hooks/use-keyboard-shortcuts.ts`

### Architecture

Attaches a single `keydown` listener to `document` in **capture phase** (not the tree container -- react-arborist focus is unreliable). Capture phase ensures `e.preventDefault()` runs before browser defaults (e.g., Ctrl+End scrolling to bottom).

Suppressed when an `INPUT`/`TEXTAREA` has focus or `editingId` is set. Target resolution priority: `selectedId` (backend cursor) → `lastKeyboardTargetId.current` (last click/action). Never uses hovered ID.

### Move Cooldown

`moveCooldownUntil` timestamp. After any move operation, set to `Date.now() + 120`. Subsequent move key presses within the cooldown are silently discarded. This prevents rapid successive moves from computing positions against stale react-arborist node state (which hasn't re-rendered yet from the previous move).

### All Shortcuts

#### Ctrl + Key (no Shift, no Alt)

| Key | Action | Notes |
|-----|--------|-------|
| `x` | `clipboard.cut(idMVC, nodeText)` | |
| `c` | `clipboard.copy(idMVC, nodeText)` | |
| `v` | `clipboard.paste(parentId, idx + 1)` | Paste after current node |
| `ArrowUp` | `moveHierarchy(idMVC, parentId, idx - 1)` | Move up among siblings (disabled if first child) |
| `ArrowDown` | `moveHierarchy(idMVC, parentId, idx + 1)` | Move down among siblings |
| `ArrowLeft` | `moveHierarchy(idMVC, grandparent.id, parentIdx + 1)` | Outdent: move after parent. **Disabled** when parent or grandparent is virtual root (prevents confusing auto-wrap) |
| `ArrowRight` | `moveHierarchy(idMVC, prev.id, prev.children.length)` | Indent: make last child of previous sibling. **Disabled** when prev is root or different parent |
| `Home` | `moveHierarchy(idMVC, parentId, 0)` | Move to first among siblings |
| `End` | `moveHierarchy(idMVC, parentId, siblingCount - 1)` | Move to last among siblings |

#### Bare Keys (no modifiers)

| Key | Action |
|-----|--------|
| `Delete` | `executeAction(idMVC, 'deleteAction')` |
| `Backspace` | `executeAction(idMVC, 'closeAction')` |
| `F2` | `executeAction(idMVC, 'editTitleAction')` |
| `o` | `activateNode(idMVC)` |
| `-` | `toggleCollapse(idMVC)` |
| `Escape` | `closeContextMenu()` (handled regardless of selection state) |

All handled keys call `e.preventDefault()` and `e.stopPropagation()` to prevent react-arborist's internal keyboard handler from also processing the event.

---

## 6.9 useClipboard

File: `src/view/hooks/use-clipboard.ts`

In-extension clipboard: `cut` stores source ID + writes text to OS clipboard (best-effort), `copy` does the same. `paste` dispatches `moveHierarchy` (cut, consumes entry) or `copyHierarchy` (copy, preserves entry). `hasClipboard` state drives UI reactivity for paste-enabled checks.

---

## 6.10 useChromeStorage

File: `src/view/hooks/use-chrome-storage.ts`

Reactive `[value, setValue]` binding to a `chrome.storage` key. Subscribes to `onStorageChanged` for cross-context updates. **IMPORTANT**: `defaultValue` must be a stable reference (primitive or memoized) -- inline object/array literals cause effects to re-subscribe on every render.

---

## 6.11 useContextMenu

File: `src/view/hooks/use-context-menu.ts`

Manages `ContextMenuState` (target node ID, nodeDTO, click coordinates). Returns `{ contextMenuState, openContextMenu, closeContextMenu }`.

---

## 6.12 useTreeDrop

File: `src/view/hooks/use-tree-drop.ts`

### External DnD Detection

`handleTreeDragOver` inspects `e.dataTransfer.types`:

| MIME Type | preventDefault | Show Overlay |
|-----------|---------------|-------------|
| `application/x-tabsoutliner-items` | Yes | Yes |
| `text/html` | Yes | No (any browser text drag sets this) |
| `Files` | Yes | Yes |

### Import Safety Check

`handleImport` calls `importContainsTabs(json)` before sending to background. If the import has no tab data (only empty window shells -- common when dragging collapsed nodes from legacy extension), shows a `window.confirm` dialog.

### First-Run Overlay

- Controlled by `localStorage` key `'importDismissed'`
- `showFirstRun` state initialized from `!localStorage.getItem(FIRST_RUN_KEY)`
- Auto-dismissed when `importResult?.success` becomes true
- Manually dismissed by user clicking "Skip -- start fresh"

### Export Download Side-Effects

Two `useEffect` hooks watch `exportJson` and `exportHtml`, create Blob URLs, trigger downloads (`.tree` as `application/json`, `.html` as `text/html`), and revoke URLs after 100ms delay.

---

## 6.13 tree-adapter

File: `src/view/tree-adapter.ts`

### nodeChildren

```typescript
function nodeChildren(dto: NodeDTO): readonly NodeDTO[] | null
```

Logic:
1. If `dto.isSubnodesPresent || dto.subnodes.length > 0` → return `dto.subnodes` (even if empty -- shows expand arrow for collapsed nodes)
2. If `dto.titleBackgroundCssClass === 'windowFrame'` → return `dto.subnodes` (always `[]` -- window/group containers are always droppable)
3. Otherwise → return `null` (true leaf node, no expand arrow)

The windowFrame case is non-obvious: without it, empty windows/groups become leaf nodes that reject drops.

`buildOpenMap` walks the tree and sets `map[idMVC] = !colapsed` for every non-leaf node. Used for react-arborist's `initialOpenState` and open/close diffs in useTreeSync.

---

## 6.14 tree-actions

File: `src/view/tree-actions.ts`

Pure message constructors for view → background communication. Each returns a typed message object with no side effects. See source for all action factory functions (`requestTree`, `activateNode`, `toggleCollapse`, `executeAction`, `moveHierarchy`, `copyHierarchy`, `importTree`, `exportTree`, `exportTreeHtml`, `createWindow`, `createGroup`, `createSeparator`, etc.).

---

## 6.15 NodeRow

File: `entrypoints/tree/components/NodeRow.tsx`

Renders individual tree nodes. See source for full render logic.

**CSS Classes** (computed per render -- important for debugging):
- `tree-node` (always)
- `selected` (if `node.isSelected`)
- `{data.titleBackgroundCssClass}` (e.g., `tabFrame`, `windowFrame`, `defaultFrame`)
- `is-selected-tab` (if `data.isSelectedTab`)
- `is-focused-window` (if `data.isFocusedWindow`)
- `cursor-node` (if `ctx.cursorId === data.idMVC`)
- `hovered` (if `ctx.hoveredId === data.idMVC`)
- `ncc-{data.nodeContentCssClass}` (if present)

---

## 6.16 ClickRow

File: `entrypoints/tree/components/ClickRow.tsx`

Custom row renderer replacing react-arborist's `DefaultRow` to make activation configurable (single-click vs double-click). Suppresses selection when inline edit is active. `onFocus` is stopped to prevent react-arborist focus management interference. See source for click behavior details.

---

## 6.17 ContextMenu

File: `entrypoints/tree/components/ContextMenu.tsx`

Portal-rendered context menu with viewport clamping. Sections: clipboard (cut/copy/paste), node actions (edit, save & close, restore, delete), move operations (up/down/indent/outdent/first/last), and collapse/expand toggle. Closes on Escape, outside click, or parent callback. See source for full menu structure and disable conditions.

---

## 6.18 MainToolbar

File: `entrypoints/tree/components/MainToolbar.tsx`

Fixed 32px toolbar at bottom. Left: create buttons (Window, Group, Separator) + export buttons (.tree, .html). Right: Settings (opens `/options.html` popup 540x680). Uses `lastKeyboardTargetId` ref for cursor-based insertion positioning.

---

## 6.19 HoveringMenu

File: `entrypoints/tree/components/HoveringMenu.tsx`

Floating action buttons anchored to hovered row's right edge via `position: fixed` + `DOMRect`. Renders two distinct variants depending on the node's `hoveringMenuActions`:

- **Close + Delete** (X icon + trash icon): shown on active tabs and windows that can be closed. Close converts to saved; delete removes entirely.
- **Delete only** (trash icon): shown on saved nodes, groups, notes, and separators that have no close action — only deletion.

The menu is hidden entirely for nodes with no actions (e.g., the root session node). Actions are determined by each node type's `buildHoveringMenuActions()` override — see `src/tree/tree-node.ts` and individual node files in `src/tree/nodes/`.

---

## 6.20 WindowFrame, StatsBlock

`entrypoints/tree/components/WindowFrame.tsx` -- Wrapper `<span>` providing visual frame around window/group containers. CSS class from `type` prop maps to window states.

`entrypoints/tree/components/StatsBlock.tsx` -- Shows tab/window/node counts for collapsed containers. Returns null if all counts are zero.

---

## 6.21 FirstRunImport

File: `entrypoints/tree/components/FirstRunImport.tsx`

Full-screen overlay on first launch. Accepts legacy extension DnD, `.tree` file drops, or file picker. Backdrop dismiss only on genuine clicks (not DnD release). See source for structure.

---

## 6.22 drag-import

File: `entrypoints/tree/components/drag-import.ts`

### extractTreeFromDrag Priority

1. `application/x-tabsoutliner-items` -- custom MIME (same-origin only; blocked cross-extension by Chrome)
2. `text/html` with `<!--tabsoutlinerdata:begin...end-->` comment -- embedded JSON
3. `text/html` `<li>/<ul>` structure -- parsed into HierarchyJSO via `parseHtmlTreeDrop`
4. `text/plain` -- try `JSON.parse` as last resort
5. `null` (no recognized tree data)

### HTML Tree Parser

The legacy extension's HTML drag format is a flat sequence of tags (NOT properly nested HTML):
```html
<li>Session</li><ul><li>Window</li><ul><li><a href="...">Tab</a></li></ul></ul>
```

Parsing strategy: tokenize as a tag stream (`<ul>` increments depth, `</ul>` decrements), produce depth-annotated `FlatNode` list, then build nested `HierarchyJSO` via recursive `buildSubtree`.

### Node Type Inference (toSerializedNode)

| Condition | Resulting Type |
|-----------|---------------|
| `isSessionTitle(title) && !url && hasChildren` | `session` |
| Has URL + has customTitle | `savedtab` with marks |
| Has URL | `savedtab` |
| Empty URL string | `textnote` |
| Has title, no URL | `savedwin` (even childless -- collapsed containers lose children in HTML) |
| No title, no URL | `textnote` (separator or empty note) |

Session detection: `title.toLowerCase() === 'current session'`. If the parsed root is not a session, it's auto-wrapped in a session node with `treeId: 'imported-{timestamp}'`.

---

## 6.23 Options Page

File: `entrypoints/options/App.tsx`. Settings page with behavior checkboxes (autoScrollToTab, openOnStartup, oneClickToOpen), appearance (lightBackground), disabled Google Drive placeholder, and About section. See `src/types/settings.ts` for `AppSettings`.

---

## 6.24 Dedication Page

File: `entrypoints/dedication/App.tsx`. Static attribution page for original developer Vladyslav Volovyk. Shown on first install (controlled by `dedication_seen` storage flag).

---

# 7. Chrome API Wrappers

> **Source**: `src/chrome/` -- thin adapters over WXT's `browser.*` namespace that add domain-type conversion, standardized error handling, event-listener cleanup, port management with auto-reconnection, and retry logic.

All wrappers import from `wxt/browser` (not raw `chrome.*`), enabling the `fakeBrowser` test double from `wxt/testing`.

**Key pattern**: ALL event subscriptions return `() => void` cleanup functions.

---

## 7.1 Error Handling (`src/chrome/errors.ts`)

`ChromeApiError` extends `Error` with `apiMethod` (e.g., `'tabs.query'`) and standard `cause` chaining. Every wrapper throws `ChromeApiError` on API failure.

### withRetry

Exponential backoff: `delay = baseDelayMs * 2^(attempt - 1)`. Defaults: 3 attempts, 1000ms base delay. `shouldRetry` predicate can abort early. `maxAttempts` clamped to `Math.max(1, value)`. Last error re-thrown when exhausted.

See `src/chrome/errors.ts` for full `RetryOptions` interface.

---

## 7.2 Port Management (`src/chrome/runtime.ts`)

### PortManager Class

Client-side (view) port manager with auto-reconnection, heartbeat keep-alive, and message queuing.

#### State Machine

```
                          +-----------+
              connect()   |           |  max attempts reached
  +-------> CONNECTING ---+           +-------> DISCONNECTED
  |           |    ^      | success   |              |
  |           |    |      v           |              |
  |           |    +-- CONNECTED      |              |
  |           |     (on disconnect    |              |
  |           |      + backoff)       |              |
  |           +-----------+           |              |
  |                                                  |
  +---- initial state ---> DISCONNECTED <--- dispose()
```

**Transitions**:

| From | Event | To | Side Effects |
|---|---|---|---|
| (initial) | constructor | `disconnected` | -- |
| `disconnected` | `connect()` | `connecting` | Resets `_reconnectAttempt` to 0, calls `_doConnect()` |
| `connecting` | `_doConnect()` success | `connected` | Resets `_reconnectAttempt` to 0, starts heartbeat, flushes queue |
| `connecting` | `_doConnect()` throws | `connecting` | Schedules reconnect with backoff |
| `connected` | port `onDisconnect` fires | `connecting` | Stops heartbeat, nulls `_port`, schedules reconnect |
| `connecting` | `_reconnectAttempt >= maxReconnectAttempts` | `disconnected` | No further reconnect attempts |
| any | `disconnect()` | `disconnected` | Clears all timers, disconnects port |
| any | `dispose()` | `disconnected` | Sets `_disposed`, clears timers, disconnects port, clears queue and listeners |

#### Reconnection with Exponential Backoff

`delay = min(reconnectBaseDelayMs * 2^reconnectAttempt, reconnectMaxDelayMs)` (defaults: base=1000, max=30000). Resets to 0 on successful reconnect.

#### Heartbeat Mechanism

Once connected, sends `{ __heartbeat: true }` every `heartbeatIntervalMs` (default 25s) to keep the MV3 service worker alive (Chrome suspends after ~30s of inactivity). Starts on connect, stops on disconnect/dispose.

#### Message Queuing

- Messages sent while disconnected/connecting are pushed to `_queue` (max 100, excess silently dropped)
- If `postMessage` throws while connected (port died but `onDisconnect` hasn't fired), message is queued
- On reconnect, `_flushQueue()` sends queued messages FIFO; if flush fails mid-send, remaining stay queued

#### Listener Isolation

Both message and state listeners are wrapped in try/catch. A throwing listener does not prevent other listeners from receiving the event.

#### Dispose Lifecycle

`dispose()` sets `_disposed = true`, disconnects port, clears all timers, empties queue, clears all listener sets. After dispose, `connect()` is a no-op.

### onPortConnect (Background Side)

Filters `browser.runtime.onConnect` by `port.name`. Returns cleanup function.

---

## 7.3 Module Summary

Each module provides typed CRUD functions and event subscriptions. See the source files for full APIs.

| Module | Purpose | Source |
|---|---|---|
| `tabs.ts` | Tab CRUD, events, `toChromeTabData` domain conversion | `src/chrome/tabs.ts` |
| `windows.ts` | Window CRUD, events, `toChromeWindowData` domain conversion | `src/chrome/windows.ts` |
| `storage.ts` | Typed `storageGet`/`storageSet`/`storageRemove`, per-key change listener | `src/chrome/storage.ts` |
| `alarms.ts` | Repeating alarms for SW keep-alive | `src/chrome/alarms.ts` |
| `action.ts` | Badge text/color, tooltip, toolbar click handler | `src/chrome/action.ts` |
| `identity.ts` | OAuth2 token management for Google Drive backup | `src/chrome/identity.ts` |
| `display.ts` | Primary display work area detection | `src/chrome/display.ts` |
| `lifecycle.ts` | `onInstalled`, `onStartup`, `onSuspend` hooks | `src/chrome/lifecycle.ts` |
| `commands.ts` | Keyboard shortcut listener | `src/chrome/commands.ts` |

**Notable**: `isExtensionUrl(url)` (in `tabs.ts`) returns true if URL starts with the extension's origin -- used to skip tracking the extension's own tabs.

---

## 7.4 Barrel Export (`src/chrome/index.ts`)

Re-exports everything from all submodules. Consumers import from `@/chrome`.

**Exported modules**: errors, storage, tabs, windows, display, action, commands, identity, runtime, lifecycle.

**Not re-exported** (import directly from submodule): `isExtensionUrl` (`@/chrome/tabs`), `createWindowWithUrl` (`@/chrome/windows`).

---

# 8. Message Contract Reference

> **Source**: `src/types/messages.ts` -- complete union types for all inter-process messages.

See `.specs/architecture.md` for the key messages table.

---

## Discriminant Fields

| Direction | Discriminant Field | Prefix Convention |
|---|---|---|
| Background -> View | `command` | `msg2view_*` |
| View -> Background | `request` | `request2bkg_*` |

All message interfaces have their discriminant field as `readonly`.

## Catch-All Generic Types

Both unions include a catch-all (`Msg_BackgroundToViewGeneric` / `Req_ViewToBackgroundGeneric`) with `readonly [key: string]: unknown`. This enables incremental typing: new messages start as generic, then get promoted to fully typed interfaces. Handlers use `default` case rather than compile-time exhaustiveness.

## Heartbeat Filtering

`PortManager` sends `{ __heartbeat: true }` which is NOT part of either message union. Background-side handlers must filter it: `if ('__heartbeat' in msg) return;`

## Exhaustive Switch Pattern

Handlers switch on the discriminant field (`command` or `request`). TypeScript narrows the message type in each case branch. The generic catch-all in each union means `default` handles unrecognized messages gracefully rather than requiring exhaustive matching -- this supports forward compatibility during incremental typing.

---

# 9. Data Flow Traces

Six representative end-to-end scenarios. See `diagrams/` for visual representations.

---

## 9.1 User Opens a New Browser Tab

**Trigger**: Chrome `tabs.onCreated` fires.

**Flow**: `onTabCreated` -> guard checks (null id, extension URL) -> `closeTracker.findByUrl` (detects Ctrl+Shift+T undo-close) -> `treeModel.findActiveWindow` (O(1) via chromeWindowIndex) -> `new TabTreeNode` -> `treeModel.insertSubnode` (at close-record position if undo-close, else last child) -> index + invalidate ancestors -> DTO broadcast to all views -> `scheduleSave` (3s debounce, 8s max-wait) -> badge update.

**View side**: `NODE_UPDATED` action -> `clonePathToRoot` (immutable path update from insertion point to root) -> react-arborist renders new row.

See `diagrams/chrome-event-flow.d2`.

---

## 9.2 User Closes a Browser Tab

**Trigger**: Chrome `tabs.onRemoved` fires.

**Flow**: `findActiveTab` via chromeTabIndex (null = untracked, return) -> `closeTracker.track` (**must** precede detach -- reads parent/sibling) -> if `isWindowClosing`, return (handleWindowRemoved owns full conversion).

**Branching**: If tab has custom marks, children, or `restoredFromSaved` -> **replace** with `SavedTabTreeNode` (preserves tree position, copies marks, sets `previousIdMVC`). Otherwise -> **remove** subtree + cursor suggestion (next sibling > prev sibling > parent) + `removeEmptyWindowParent` (cleans up childless, unmodified window nodes).

**View side**: Replace path triggers `FULL_REFRESH_NEEDED`; remove path triggers `NODE_REMOVED` + `SET_CURSOR`.

---

## 9.3 User Drags a Node (DnD)

**Trigger**: react-arborist `onMove` with `{ dragIds, parentId, index }`.

**Flow**: View sends `request2bkg_moveHierarchy` -> background looks up source node -> **auto-wrap**: if moving a tab to root, creates `SavedWindowTreeNode` wrapper -> if target parent collapsed, expands it -> `treeModel.moveNode` (detach from old parent, reset structure dIds, insert at new parent, reindex, invalidate both ancestor chains).

**View side**: `onNodeMoved` -> `FULL_REFRESH_NEEDED` -> re-requests full tree -> `INIT` action with complete rebuild.

See `diagrams/tree-mutation-flow.d2`.

---

## 9.4 User Edits a Node Title

**Trigger**: Context menu "Edit Title" or hover menu edit action.

**Flow**: View sends `activateHoveringMenuAction` with `editTitleAction` -> background validates actionId -> broadcasts `msg2view_activateNodeTabEditTextPrompt` (or window/note variant) with `defaultText` and `targetNodeIdMVC` -> view enters edit mode (`START_EDITING` action, renders inline `<input>`).

**On submit**: View sends `onOkAfterSetNodeTabTextPrompt` with `newText` -> background sets `customTitle` mark (empty string -> `undefined` removes it) -> broadcasts `NODE_UPDATED` -> view applies via `clonePathToRoot`.

**Non-obvious**: Separator "edit" cycles through styles rather than showing an input.

---

## 9.5 User Imports a .tree File

**Trigger**: File drop on tree view or FirstRunImport button.

**Flow**: View reads file via `FileReader`, sends `request2bkg_import_tree` -> background parses: tries HierarchyJSO first, falls back to operations log format -> `deactivateHierarchy` (tab->savedtab, win->savedwin, clears active/focused, strips invalid favicons, deletes Chrome runtime IDs) -> merge imported children under existing root -> `synchronizeTreeWithChrome` (crash recovery) -> **immediate save** (bypasses debounce) -> broadcasts import result + full tree init.

**Error paths**: JSON parse failure, >10MB size check, invalid format detection. Result message sent to requesting port only (not broadcast).

**View side**: `IMPORT_RESULT` (success/failure toast) + `INIT` (full tree replacement with open/close sync).

---

## 9.6 Service Worker Terminates and View Reconnects

**Trigger**: Chrome kills SW after ~30s inactivity (or crash). All in-memory state lost; `chrome.storage.local` survives.

**View side**: `PortManager.onDisconnect` fires -> state `connected` -> `connecting` -> exponential backoff (1s, 2s, 4s... capped 30s). Each attempt calls `browser.runtime.connect`.

**Background side**: Connection attempt wakes SW -> `ActiveSession.create()` loads tree from storage -> `synchronizeTreeWithChrome` (crash recovery) -> registers event handlers -> alarm keep-alive -> `onPortConnect` fires -> `viewBridge.addPort`.

**Reconnection complete**: PortManager transitions to `connected`, resets backoff counter, starts 25s heartbeat, flushes queued messages -> `usePort` detects reconnection (not first connect) -> calls `onReconnect` -> re-requests full tree -> `INIT` action with complete tree rebuild + `useTreeSync` open/close sync (iterates entire tree, suppresses `onToggle` echoes during sync).

**Non-obvious**: All MvcIds are new after SW restart (counter resets). `previousIdMVC` on replaced nodes enables view reconciliation if needed.

See `diagrams/reconnection-flow.d2`.

---

# 10. Configuration & Build

> **Sources**: `wxt.config.ts`, `package.json`, `vitest.config.ts` -- read these files for full configuration details.

---

## 10.1 Permissions

**Required permissions** (granted at install):

| Permission | Used By |
|---|---|
| `alarms` | Service worker keep-alive, periodic save scheduling |
| `storage` | Tree persistence, settings, session data |
| `tabs` | Tab tracking, creation, removal, focus management |
| `unlimitedStorage` | Large tree data (thousands of nodes) |
| `favicon` | `chrome://favicon/` API for tab favicons |

**Optional permissions** (requested at runtime):

| Permission | Used By |
|---|---|
| `identity` | Google OAuth2 for Drive backup |
| `identity.email` | Email-based license validation |
| `system.display` | Work area detection for window positioning |
| `clipboardRead` | Paste tree data from clipboard |
| `clipboardWrite` | Copy tree data to clipboard |

---

## 10.2 Path Alias

`@/` resolves to `src/` directory. Implemented via a custom Vite plugin (`enforce: 'pre'`) in `wxt.config.ts` that tries extensions in order: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `''`, then `/index` variants. `tsconfig.json` has a matching alias for editor support.

---

## 10.3 Versioning

Two version fields must be kept in sync:

| Field | Location | Format | Current |
|---|---|---|---|
| `manifest.version` | `wxt.config.ts` | Chrome quad-version: `MAJOR.MINOR.PATCH.BUILD` | `2.0.1.1` |
| `version` / `version_name` | `wxt.config.ts` / `package.json` | SemVer with pre-release | `2.0.0-beta.1` |

Both must be bumped on every epic commit to main. Beta bumps increment the `version_name` patch segment (`2.0.1.N`); v1 resets to `2.0.0.0`.

---

## 10.4 Content Security Policy

`script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'` -- scripts from extension origin only, inline styles allowed (needed for Preact).

---

# 11. Test Infrastructure

## Framework

**Vitest 3.1** with **happy-dom** (faster than jsdom). Config in `vitest.config.ts`. Globals enabled (`describe`, `it`, `expect` available without imports). Plugins mirror build config: `pathAliasPlugin()`, `preact()`, `WxtVitest()`.

## Browser API Mocking

**`fakeBrowser`** from `wxt/testing` provides in-memory Chrome API stubs (tabs, windows, storage, runtime). Reset with `fakeBrowser.reset()` in `beforeEach`. Events triggered via `fakeBrowser.tabs.onCreated.trigger(...)` etc.

APIs not covered by fakeBrowser (`identity`, `system.display`) use manual `vi.mock('wxt/browser')`.

## Key Test Helpers

**`createFakePort`** in `src/chrome/__tests__/runtime.test.ts` -- simulates Chrome runtime ports with `_fireMessage()` and `_fireDisconnect()` helpers for full PortManager lifecycle testing.

**`vi.useFakeTimers()`** for backoff/interval tests. Use `vi.advanceTimersByTimeAsync()` when timer callbacks contain `await`.

**`fake-indexeddb`** (`import 'fake-indexeddb/auto'`) replaces global IndexedDB for legacy migration tests.

## Component Testing

`@testing-library/preact` (`render`, `screen`, `act`, `renderHook`). App-level tests mock `usePort` to control port behavior and inject messages. See `entrypoints/tree/App.test.tsx`.

## Test File Organization

```
src/chrome/__tests__/           # Chrome API wrapper tests
src/background/__tests__/       # Service worker orchestration tests
src/tree/__tests__/             # Tree model + node type tests
src/tree/__tests__/nodes/       # Per-node-type tests
src/tree/__tests__/integration/ # Large tree + round-trip tests
src/view/hooks/__tests__/       # Hook tests (usePort, useTreeData, etc.)
src/storage/__tests__/          # Persistence + migration tests
src/serialization/__tests__/    # Codec + format tests
entrypoints/tree/               # App.test.tsx, TreeBasic.test.tsx
```

Conventions: `__tests__/` co-located with source, `.test.ts` for logic, `.test.tsx` for JSX.

---

# 12. Modernization Plan Divergences

Compares the original plan (`docs/modernization-plan.md`) against what was built. The codebase is authoritative.

---

## 12.1 Zustand Planned, Not Used

**Plan**: Zustand + `@preact/signals` for state management. **Built**: `useReducer` in `useTreeData` + `useRef` indexes. **Why**: Background-owns-state architecture eliminated client-side store needs. Each view independently connects via its own port.

## 12.2 dnd-kit Planned, Not Used

**Plan**: dnd-kit for toolbar-to-tree and external drops. **Built**: react-arborist's built-in HTML5 DnD + native browser drag events in `useTreeDrop`. **Why**: Toolbar create ops became button clicks with cursor-position insertion, eliminating the dnd-kit use case.

## 12.3 Epic Ordering Diverged

**Plan**: Epic 7 -> 8 -> 9 -> 12 (Phase 3), Epics 10/11 in Phase 4. **Built**: Epic 11 completed before 12, Epic 10 deferred post-v1, Epic 8 scope absorbed into other epics, data migration extracted as standalone effort. **Why**: Prioritized usable end-to-end experience for beta milestone.

## 12.4 Node Type Naming

**Plan**: `TabActiveNode`, `TabSavedNode`, etc. **Built**: `TabTreeNode`, `SavedTabTreeNode`, etc. (`*TreeNode` suffix, qualifier-first). **Why**: Clearer class hierarchy, more natural English reading, matches `NodeTypesEnum` values.

## 12.5 chrome.storage.session Not Used

**Plan**: Session storage for faster SW restart recovery. **Built**: Full reconstruction from `chrome.storage.local` + live Chrome API queries. Session storage was unnecessary given fast local reads and crash recovery.

## 12.6 Tab Change Polling Not Implemented

**Plan**: Port legacy `checkTabsChanges()` polling. **Built**: Pure Chrome event listeners. MV3's event API is reliable enough to eliminate polling.

## 12.7 Flat Map Store Not Implemented

**Plan**: Flat `Map<NodeId, NodeDTO>` in Zustand. **Built**: Hierarchical `NodeDTO` tree + ref-based indexes (`nodeIndex`, `parentIndex`). **Why**: react-arborist expects nested data (`data[].subnodes[]`).

## 12.8 visibilitychange Recovery Not Implemented

**Plan**: `visibilitychange` listener for sleep recovery. **Built**: `PortManager`'s `onDisconnect` + exponential backoff handles all cases. Port disconnect is the reliable signal regardless of cause.

## 12.9 Feature Status

See `docs/modernization-plan.md` for the original plan. Key deviations: GDrive re-auth deferred (Epic 10), kiosk URL re-open and always-on-top not implemented, URL/text external drops not yet supported.

---

# 13. Screenshots

All screenshots in `snapshots/`. Dark mode only (light mode not yet implemented).

| Screenshot | Shows |
|------------|-------|
| General tree segment with primary node types | Windows, tabs, groups, separators in normal view |
| named nodes deep nesting and closed container | Custom-named nodes, deep hierarchy, collapsed container |
| Context menu with some active and some disabled | Right-click menu with conditional item states |
| hover menu save + delete | Hover actions on a closeable node |
| hover menu only delete | Hover actions on a non-closeable node |
| Inline editing a container | Edit input active on a window/group |
| Inline editing a tab (no input yet) | Edit prompt state before typing |
| toolbar | Bottom toolbar with New Window/Group/Separator buttons |
| DnD in progress | Drag indicator visible between nodes |
| First run import modal | Drag-drop/file import prompt on first use |
| First run modal with in-progress legacy DnD | Import overlay with legacy extension DnD active |
| First load dedication page | Dedication page honoring Vladyslav Volovyk |
| settings + dedication page | Options page with settings toggles |
| Chrome top bar showing extension icon + badge | Browser action icon with tab count badge |

**Not captured** (would require specific setup):
- Light theme (not implemented yet)
- Connection/reconnection banner (service worker restart too fast without Chrome throttling)

---


**Related**: [../constitution.md](../constitution.md), [../architecture.md](../architecture.md), [../../.claude/project-summary.md](../../.claude/project-summary.md), [../../docs/modernization-plan.md](../../docs/modernization-plan.md)
