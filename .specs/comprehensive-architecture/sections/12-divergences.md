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
