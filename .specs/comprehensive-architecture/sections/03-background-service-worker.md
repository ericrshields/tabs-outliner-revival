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
