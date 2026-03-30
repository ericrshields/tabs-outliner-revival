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
