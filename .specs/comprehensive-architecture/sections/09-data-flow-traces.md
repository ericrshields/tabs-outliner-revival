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
