# Tabs Outliner Revival: Full Modernization Plan

## Context

Tabs Outliner is a mature Chrome extension (~900KB of vanilla JS) with a custom MVC architecture, no build system, and no typing. The original author (Vladyslav Volovyk, Ukrainian) appears to have abandoned it — possibly a casualty of the war in Ukraine. The user made it functional via a commit that gutted broken Google identity/OAuth2 checks, hardcoded a license key, bypassed signature validation, and added fallback window sizing. The identity flow was gutted primarily because Google's APIs changed after the author stopped updating, causing the "always logged out" state.

**Goal**: Modernize to a typed, component-based architecture that is lightweight, stable, and reusable across extension projects. Fix known bugs, add requested features. Maintain full backward compatibility with existing user tree data.

**Git workflow**: Feature branches for all work. Squash/rebase on merge to main. No PRs needed.

---

## Original Extension Ecosystem

- **No official GitHub repo** from Vladyslav Volovyk found
- **Chrome Web Store**: Status unclear — may still be listed but unmaintained
- **Community forks**: Firefox port ([FFTabsOutliner](https://github.com/guyzmo/FFTabsOutliner)), DB extractor tool ([tabs-outliner-db-extractor](https://github.com/tommuhm/tabs-outliner-db-extractor))
- **Chore**: Add a note/review comment to the existing Chrome Web Store listing about this revival project

---

## Tech Stack

### Framework: Preact + preact/compat (eject to React if needed)

**Decision**: Start with Preact for lightweight runtime. If compat issues arise with react-arborist or dnd-kit, swap to React via a single config change in `wxt.config.ts`.

| Metric | React + ReactDOM | Preact + compat |
|--------|-----------------|-----------------|
| Bundle size (min+gz) | ~42KB | ~3KB |
| Memory overhead | Moderate (vDOM + Fiber) | Low |
| Concurrent rendering | Yes (useTransition, Suspense) | No |
| React library compat | Native | ~99% via shim (edge cases with refs, context, internals) |

Preact cuts size by removing: synthetic event system (unnecessary for Chrome-only), Fiber concurrent renderer, and strict mode double-rendering. `@preact/signals` provides fine-grained reactivity for high-frequency updates that bypass vDOM.

**Eject path**: Remove the `react` → `preact/compat` alias in `wxt.config.ts`. All code imports from `react` so nothing else changes.

### Build System: WXT (Web Extension Tools)

- Vite-based, fast HMR, manifest auto-generation from file-based entrypoints
- First-class Preact support, handles service worker bundling
- Actively maintained (CRXJS is seeking new maintainers; Plasmo is Parcel-based, ~2x larger output)

### State Management: Zustand (not Context + useReducer)

**Decision**: Zustand (~1KB gzipped) over React Context + useReducer.

| Criterion | Zustand | Context + useReducer |
|-----------|---------|---------------------|
| Re-render scope | Only subscribers to changed slice | All consumers of the context |
| Cross-view state | Works outside React tree (service worker) | Requires React tree |
| Boilerplate | Minimal | Moderate (provider wrapping, dispatch typing) |
| Devtools | Built-in middleware | Manual |

Context causes unnecessary re-renders for all consumers when any value changes. For an extension where multiple views subscribe to a tree with frequent node-level updates (tab titles, favicons), selective subscriptions are critical. Zustand also works outside the React tree, which matters for service worker ↔ view communication.

### Key Libraries

| Purpose | Library | Size | Why |
|---------|---------|------|-----|
| Tree view | react-arborist | ~15KB | Virtualized rendering, built-in DnD, keyboard nav, custom renderers |
| Drag & drop (external) | dnd-kit | ~10KB | Toolbar-to-tree drops. Priority: Low (external DnD is QoL, not core) |
| State (UI) | Zustand | ~1KB | Selective subscriptions, works outside React tree |
| State (tree) | Custom TypeScript class | 0 | Domain model — too specific for a generic lib |
| Styling | CSS Modules + component defaults | 0 runtime | Start with default component styles; add custom styling as needed |
| Testing | Vitest + @testing-library/preact | dev only | Vite-native |

### Performance Targets

- **Target tree size**: 100-200 nodes typical, 500 max expected
- **Stretch**: 5000+ node support is low priority but should not be architecturally prevented
- **Bundle budget**: <50KB production JS (framework + app)
- **Note in docs**: Recommend tree sizes and document the point at which slowdowns become noticeable

---

## Bugs, Features, and Priorities

### High Priority

| # | Type | Description | Root Cause | Epic |
|---|------|-------------|------------|------|
| B1 | Bug | Unresponsive after sleep — entries can't be clicked | `chrome.runtime` ports enter broken state after sleep; no reconnection logic | 2, 5, 6 |
| B2 | Bug | Google Drive re-auth every load | `authTokenInvalidOrAbsent_dropAndNotifyAllOpenedViews()` calls `removeCachedAuthToken` on **connection errors**, not just 401s. Transient network failures at startup nuke the cached token, forcing interactive re-auth | 10 |
| B4 | Bug | Can't drag and scroll — nav buttons interfere | Drag feedback and scroll zones overlap with fixed-position toolbar buttons | 7, 8 |
| B6 | Bug | New windows have wrong sizes | `numberToInteger()` rejects valid values; fallback hardcodes 1024x720 instead of reading saved dimensions | 4 |
| B7 | Feat | Create group/window at cursor position | Insert operations always append to tree bottom; no cursor-aware insertion | 4, 7 |
| F1 | Feat | Move off internal IndexedDB for tab data storage | Current `TabsOutlinerDB34` IndexedDB is hard to back up, inspect, and migrate. Explore `chrome.storage.local`, JSON files, or other accessible formats | 3, 5 |
| F2 | Feat | Save-and-close (green X) always visible | Button currently only appears on hover, causing accidental tab closes due to button alignment shift. Show disabled state when tab already closed | 7 |
| F3 | Feat | Undo close tab from tree UI | When tab closed via tree (not Chrome), allow undo. When undone via Chrome (Ctrl+Shift+T), restore tab to its tree position instead of new window at bottom | 4, 5 |
| F4 | Feat | Re-open kiosk/extension URLs properly | Currently always re-opens as standard tab with URL. Should use same approach as original (kiosk mode, extension URL handler, etc.) | 4 |

### Medium Priority

| # | Type | Description | Epic |
|---|------|-------------|------|
| B5 | Bug | Copy-paste doesn't work | 9 |
| F5 | Feat | Main view "always on top" | 12 |

### Low Priority

| # | Type | Description | Epic |
|---|------|-------------|------|
| B3 | ~~Bug~~ Resolved | Payment links broken | Eliminated — licensing replaced with dedication page |
| F6 | Feat | External DnD (URLs, text, HTML into tree) | 8 |
| F7 | Feat | Additional cloud backup providers (Dropbox, Box, S3-compat) | 10+ |

### Very Low Priority (defer post-v1)

These features exist in the original but are not used by the current maintainer. Implement only if adoption demands it:

- Note node, GDoc node types (keep in type system for data compat; skip UI)
- Scroll to open window, clone view, return-after-scroll
- Advanced keyboard controls beyond basic nav and copy/paste (flatten tree, export = buttons instead)
- Tree recoloring / custom marks
- Auto-scroll main window to current tab

### Chores

| # | Description | Priority |
|---|-------------|----------|
| C1 | Add review comment to existing Chrome Web Store extension about revival project | Medium |
| C2 | Dedication page for Vladyslav Volovyk — auto-opens on first start. Includes original payment link with note about war in Ukraine | Part of Epic 11 |
| C3 | Small optional donation link for current maintainer (about/help page, unobtrusive) | Part of Epic 11 |

---

## Licensing Decision

**Remove all license checking, signature validation, and gating code.** Extension is fully free and open.

Replace with:
1. **Dedication page** for Vladyslav Volovyk (copyright holder in all source files). Auto-opens on first extension start. Includes original payment/donation link with note that, given the war in Ukraine, the author may never receive it.
2. **Small optional donation link** for current maintainer (in about/help section, not intrusive).

Google Identity is still needed for Google Drive backup (Epic 10) but not for licensing.

---

## Epic Breakdown

### Epic 0: Project Scaffolding and Dual-Run Setup — **M**

Move existing code to `legacy/` subfolder. Initialize WXT + Preact + TypeScript project in the root. Both versions loadable as separate unpacked extensions.

**Scope**:
- `npx wxt@latest init` with Preact template
- TypeScript strict mode, path aliases, `preact/compat` alias in `wxt.config.ts`
- Move all existing files to `legacy/`, update legacy `manifest.json` paths
- ESLint + Prettier config
- Vitest + `@testing-library/preact`
- WXT entrypoint stubs: `entrypoints/background.ts`, `entrypoints/tree.tsx`, `entrypoints/options.tsx`
- Fix MV3 manifest: `_execute_browser_action` → `_execute_action` in WXT config
- **Prototype react-arborist + Preact**: Build a minimal tree (not just "verify it loads") to validate compat before Epic 7. If it fails, eject to React immediately.
- Verify both old and new load as separate extensions

**Dependencies**: None
**Bugs addressed**: None (foundation)

---

### Epic 1: TypeScript Type System — **L**

Define the complete type system shared across all modules.

**Scope**:
- `NodeType` discriminated union matching `NodesTypesEnumNum2Str` at `treemodel.js:2462` **exactly** (order-sensitive — "WARNING The order is important! DONT INSERT ANYTHING IN THE MIDDLE!!!"):
  - `TAB`, `SAVEDTAB`, `WAITINGTAB` (deprecated), `ATTACHWAITINGTAB`, `WINDOW`, `SAVEDWINDOW`, `WAITINGWINDOW` (deprecated), `SESSION`, `TEXTNOTE`, `SEPARATORLINE`, `GROUP`
  - Note: `link` and `gdoc` are NOT separate node types — they are display properties/marks on existing types. Verify during implementation.
  - `ATTACHWAITINGTAB` must be included even if rarely used — existing tree data may contain it and deserialization would silently corrupt without it.
- `TreeNode` interface hierarchy with discriminant on `type` field
- `NodeMarks` type (relicons, customTitle, customColor, protection flags)
- Branded ID types (`NodeId`, `MvcId`) to prevent mix-ups
- Typed message protocol (replacing untyped `msg.request` / `self[msg.request]()` dispatch)
- Serialization format types (the condensed `dId/cdId/sdId/sdIdKnot` format from `frontendview.js`)
- `DropTarget` and drag data types (from `modelviewcomunication.js`)

**Dependencies**: Epic 0
**Key files**: `treemodel.js:2462` (NodeTypesEnum + NodesTypesEnumNum2Str), `modelviewcomunication.js` (DTOs), `frontendview.js` (serialization format)

---

### Epic 2: Chrome API Integration Layer — **L** (reusable)

Typed, promise-based wrappers for all Chrome extension APIs. Designed as a standalone module reusable by any Chrome extension.

**Scope**:
- `chrome.tabs` — CRUD, event subscriptions with typed callbacks
- `chrome.windows` — create/remove/focus/getAll, events
- `chrome.storage` — typed get/set for `sync`, `local`, and `session` (MV3); change listeners
- `chrome.identity` — OAuth2 token lifecycle (interactive + non-interactive)
- `chrome.runtime` — typed message passing, **port management with auto-reconnection and heartbeat** (B1)
- `chrome.action` — badge, tooltip
- `chrome.commands` — keyboard shortcut handlers
- `chrome.system.display` — work area bounds
- Service worker lifecycle hooks (`onStartup`, `onInstalled`, `onSuspend`)
- Error handling, retry logic, exponential backoff for disconnected ports

**Dependencies**: Epic 1
**Bugs addressed**: B1 (port reconnection after sleep)

---

### Epic 3: Data Migration and Serialization — **L** (high risk)

Port the serialization/deserialization system so existing tree data survives the migration. Deliberately early to de-risk the project. Also explore moving off IndexedDB (F1).

**Scope**:
- IndexedDB reader for `TabsOutlinerDB34` schema
- Port `getKnotSubnodes()` — recursive knot resolution (`frontendview.js:9`)
- Port `SybnodesChangesMonitor` active functions (`treemodel.js:150-365`, NOT the commented-out class at line 76):
  - `SybnodesChangesMonitor_serializeCurSubnodes()` (~line 162)
  - `SybnodesChangesMonitor_restoreSubnodesList()` (~line 206)
  - `getBaseSubnodesArray()` (~line 232)
- Port `restoreTreeStructure()`, `deserializeKnot()`, `deserializeEntry()` (`frontendview.js:46`)
- Port `serializeAsOperationsLog()` for write-back
- Port operation types from `dboperations.js` (`DbOperations.OperationsEnum`, `NodeOperationInsert`, etc.)
- Round-trip validation: load existing data → serialize → compare
- `.tree` file import/export support
- **F1 exploration**: Evaluate `chrome.storage.local` or JSON-file-based storage as replacement for IndexedDB. Key constraint: `chrome.storage.local` has a 10MB limit (with `unlimitedStorage` permission this is relaxed). Prototype new storage format alongside old reader.
- **Zero data loss guarantee**: old data is read-only during migration; new storage is separate

**Dependencies**: Epic 1
**Key files**: `frontendview.js` (deserialization core), `treemodel.js:150-365` (active SybnodesChangesMonitor functions), `tree/js/dboperations.js` (operation log format)
**Risk**: Highest in the project. The diff algorithm has Ukrainian/Russian comments, custom encoding, and recursive knot resolution. Must be ported with byte-level fidelity.

---

### Epic 4: Core Tree Data Model — **XL**

Rewrite `treemodel.js` (239KB) in TypeScript. The heart of the extension — pure tree operations only (no Chrome API side effects).

**Scope**:
- `TreeModel` class: root management, find/traverse, hierarchy operations
- Node class hierarchy (abstract base + concrete per `NodeType`):
  - `TabActiveNode`, `TabSavedNode`, `WindowActiveNode`, `WindowSavedNode`
  - `GroupNode`, `NoteNode`, `TextLineNode`, `SeparatorNode`, `SessionNode`
  - `AttachWaitingTabNode` (rarely used but needed for data compat)
- Node operations: insert (including **at cursor position** — B7), delete, move, collapse/expand, mark management
- Window position/size tracking with **proper bounds validation** (B6): validate against display work area, handle 0/NaN/negative values correctly, preserve and restore saved dimensions
- **F3 (undo close)**: Track recently-closed tab positions for undo support; maintain tab-to-tree-position mapping
- **F4 (kiosk/extension URLs)**: Store and restore window type metadata (normal, popup, app) and use appropriate `chrome.windows.create()` options
- DTO generation (`NodeModelMVCDataTransferObject`) for view communication
- Separate pure tree operations from Chrome side effects (testability)

**Dependencies**: Epic 1, Epic 2, Epic 3
**Bugs addressed**: B6 (window sizing), B7 (cursor-position insertion)
**Features addressed**: F3 (undo close), F4 (kiosk/extension re-open)

---

### Epic 5: Service Worker / Background Script — **XL**

Rewrite `background.js` (207KB) as a WXT background entrypoint. Owns `ActiveSession` — the orchestrator that wraps the pure `TreeModel` (Epic 4) with Chrome integration.

**Scope**:
- WXT `defineBackground()` entrypoint
- **`ActiveSession` class** (from `background.js:2062`): initialization, persistence manager integration, Chrome event registration. This is a service worker orchestrator, not a pure model class — it belongs here, not in Epic 4.
- Typed port-based communication hub (replaces `self[msg.request]()` dispatch)
- Tab/window event dispatching to tree model
- Tree-Chrome correlation: `asyncSynchronizeTreeWithOpenWindowsList()` (crash recovery)
- Browser action handling (badge, tooltip, click → open tree tab)
- Command processing (`save_close_current_tab`, `save_close_current_window`, etc.)
- Service worker keep-alive: `chrome.alarms` heartbeat, `chrome.storage.session` for state persistence across SW restarts
- **Startup reconstruction path**: On browser start (when `chrome.storage.session` is empty), reconstruct tree from `chrome.storage.local` / IndexedDB + Chrome API queries
- Proper `onSuspend` cleanup
- Tab change polling (port the `checkTabsChanges()` / `lastSeenTabs` diffing)
- **F3 (undo close)**: Service worker tracks closed-tab history; responds to `chrome.tabs.onCreated` for Ctrl+Shift+T detection and restores tree position
- Strip all license key checking code

**Dependencies**: Epic 1, Epic 2, Epic 4
**Bugs addressed**: B1 (service worker lifecycle, port reconnection)
**Features addressed**: F3 (undo close tab)

---

### Epic 6: State Management and View-Background Sync — **L**

Bridge between service worker (owns tree) and UI views (render it).

**Scope**:
- Zustand store for UI state (cursor, view mode, drag state, modal state)
- `useTreeStore` hook: subscribes to background port messages, maintains client-side tree mirror (flat `Map<NodeId, NodeDTO>` for O(1) lookup)
- `useChromeStorage` hook: typed reactive wrapper for `chrome.storage`
- Incremental sync protocol: initial full tree transfer → node-level update messages
- `@preact/signals` for high-frequency updates (tab title/favicon changes) to skip vDOM
- Auto re-sync on port reconnection (B1 recovery path): `document.addEventListener('visibilitychange')` detects wake from sleep → close old port → create new port → request full tree re-sync
- Settings change broadcast to all views

**Dependencies**: Epic 1, Epic 2, Epic 5
**Bugs addressed**: B1 (auto re-sync after sleep wake)

---

### Epic 7: Tree View UI — **XL**

The primary UI. Replaces `treeview.js` (135KB).

**Scope**:
- Virtualized tree via react-arborist in **controlled/read-only mode**: all mutations dispatch to background service worker; tree updates flow back via port messages. The Zustand tree mirror (Epic 6) is what react-arborist renders — it is updated only on background confirmation.
- Custom node renderers per type (tab, window, group, separator, session — skip note/gdoc for v1)
- **F2 (save-and-close always visible)**: Green X button rendered persistently on each active tab node, shown disabled/grayed when tab is already saved/closed
- Tree lines via CSS borders/SVG (replacing PNG tile sprite system)
- Hovering menu on `:hover` (expand/collapse, edit, delete)
- Expand/collapse with CSS transitions
- Stat blocks on collapsed nodes (subnode counts)
- Cursor management
- **Scroll zones at tree edges for drag-scroll** (replaces nav-button overlap — B4)
- Node tooltips, protected-from-close indicators
- Start with **default component styles** — custom theme/styling is a separate future task
- Dark/light theme via CSS custom properties (basic toggle only)

**Dependencies**: Epic 6, Epic 1
**Bugs addressed**: B4 (drag-scroll redesign)
**Features addressed**: F2 (always-visible save-and-close)

---

### Epic 8: Drag and Drop — **L**

Internal tree DnD is core; external DnD is low priority.

**Scope (core — high priority)**:
- Internal tree DnD (react-arborist): move as sibling/child, copy on Ctrl+drag, drop validation
- **Auto-scroll during drag** at tree container edges (B4 fix)
- Drop feedback visualization (insertion indicator lines)
- Cursor-aware drop positioning (B7)
- Toolbar action link DnD: New Window/Group/Separator from toolbar into tree

**Scope (low priority — defer if needed)**:
- External content drops: `text/uri-list`, `text/plain`, `text/html` → appropriate node types (F6)
- dnd-kit integration for external drops
- Cross-view drag notification

**Dependencies**: Epic 7, Epic 4
**Bugs addressed**: B4 (drag-and-scroll), B7 (insert at cursor)

---

### Epic 9: Context Menu and Copy/Paste — **M**

Replaces `contextmenu.js` (~12KB, 375 lines). Scoped down from original — advanced keyboard controls deferred.

**Scope (core)**:
- Custom context menu component
- Essential actions: Cut/Copy/Paste, Collapse/Expand, Edit, Save & Close, Delete, Restore
- Move operations: indent/outdent, up/down
- **`navigator.clipboard` API integration** with proper `clipboardRead`/`clipboardWrite` permission handling (B5)
- Basic keyboard shortcuts: Arrows, Enter, Del, Backspace, Ctrl+X/C/V

**Scope (very low priority — defer)**:
- Note-specific actions (Insert as parent/child/sibling)
- Advanced keyboard: flatten tree, export, window navigation (make these buttons instead)
- Global shortcuts: W, S, C, Q

**Dependencies**: Epic 7, Epic 4. **Must complete before Epic 12.**
**Bugs addressed**: B5 (copy-paste)

---

### Epic 10: Google Drive Backup — **L**

Proper OAuth2 and Google Drive v3 integration.

**Scope**:
- OAuth2 flow: non-interactive token refresh first, interactive only when needed
- **B2 fix**: Do NOT call `removeCachedAuthToken` on connection/network errors — only on HTTP 401. The current code nukes the token cache on transient failures, forcing interactive re-auth.
- Token caching with proper invalidation
- Google Drive API **v3** (current code uses v2 — note response shape changes: `data.items` → `data.files`, `modifiedDate` → `modifiedTime`)
- Backup to appData folder: create, list, download, delete (rotation)
- `chrome.alarms`-based scheduling (survives SW restart)
- Manual backup button with progress indicator
- Error states with user-facing messages
- Local file export/import as GDrive alternative
- **Backup restore view**: The existing `backup/backupview/` directory contains a separate restore UI. Decision: **defer to post-v1** — local file import/export is sufficient for v1. Note in docs.
- **F7 (additional providers)**: Low priority. Architecture should allow pluggable backup providers, but only GDrive implemented in v1.

**Dependencies**: Epic 2, Epic 5
**Bugs addressed**: B2 (re-auth every load)

---

### Epic 11: Options, About, and Dedication Pages — **S**

Rewrite `options.js` (48KB) + `options.html`. Add dedication and donation.

**Scope**:
- WXT options entrypoint (`entrypoints/options.tsx`)
- Settings: autoscroll, open-on-startup, one-click mode, light/dark theme, window position restoration
- GDrive backup controls (authorize/deauthorize, backup now, status, rotation count)
- Import/export settings
- `useChromeStorage` hook for reactive settings
- **Remove all license key management UI**
- **Dedication page** (`entrypoints/dedication.tsx`): Honor Vladyslav Volovyk as original author. Include original payment/donation link. Note about war in Ukraine and uncertainty of receipt. **Auto-opens on first extension start** (tracked via `chrome.storage.local` flag).
- **Donation link**: Small, optional link for current maintainer in about/help section

**Dependencies**: Epic 2, Epic 6

---

### Epic 12: Main View (Active Session) — **L**

Replaces `activesessionview.js` (~50KB, 1576 lines) + HTML + messages.

**Scope**:
- WXT unlisted page entrypoint for the tree tab
- Toolbar: action link buttons (New Window, Group, Separator), backup, info/help/settings
- Notification/banner system (backup status, help)
- Tree view integration (Epic 7 component)
- Scroll compensator (`ResizeObserver`-based)
- **F5 (always on top)**: Medium priority — explore `chrome.windows.update({ alwaysOnTop: true })`. Note: only works when extension window is a popup-type, not a regular tab.
- First-start trigger: open dedication page on first load

**Dependencies**: Epic 6, Epic 7, Epic 8, **Epic 9** (must complete first)
**Bugs addressed**: B1 (view reconnects automatically), B4 (toolbar redesign)

---

### Epic 13: Side Panel Exploration — **M** (post-v1)

Explore adding a Chrome Side Panel mode as a secondary view alongside the main tree tab.

**Concept**: Side panel shows a **tree-style tab list for the current window only**, replacing Chrome's flat vertical tab list (Chrome has no native tree-style display, only flat vertical tabs since 2024). Main tree tab remains the cross-window organizer for everything.

**Key behaviors to explore**:
- Side panel instance per-window (each shows only that window's tabs as a tree)
- Auto-expand current window's subtree, collapse others
- Read-only or limited-edit view (full editing in main tree tab)
- Sync with main tree model via service worker
- Can reuse tree view component (Epic 7) with filtered data source

**Technical notes**:
- `chrome.sidePanel` API with `windowId` parameter
- Each window gets its own panel instance (separate page loads)
- WXT supports side panel entrypoints natively

**Dependencies**: Epics 0-12 (v1 complete)
**Open questions**: Performance of multiple panel instances, UX for saved-but-not-open tabs

---

### Epic 14: Testing and QA — **L** (ongoing throughout all phases)

**Scope**:
- Unit tests: tree model operations, serialization round-trips, Chrome API wrappers, message protocol
- Component tests: node renderers, hovering menu, context menu, options page, toolbar
- Integration tests: background-view communication, tree sync after Chrome events, DnD sequences
- **Backward compatibility snapshot tests** for serialization format
- Performance benchmarks: 500-node tree rendering and update throughput (stretch: 5000+)
- Chrome API mocks at the wrapper layer (Epic 2)

**Dependencies**: All (test alongside each epic, not a final phase)

---

## Suggested Build Order

```
Phase 1 — Foundation          Phase 2 — Core Engine       Phase 3 — UI
┌──────────────────┐          ┌──────────────────┐       ┌──────────────────┐
│ Epic 0: Scaffold │          │ Epic 4: Tree     │       │ Epic 7: Tree UI  │
│   + Preact proof │          │   Model (pure)   │       │ Epic 8: DnD      │
│ Epic 1: Types    │ ──────>  │ Epic 5: Service  │ ───>  │ Epic 9: Context  │
│ Epic 2: Chrome   │          │   Worker + AS    │       │   Menu + Keys    │
│ Epic 3: Migrate  │          │ Epic 6: State    │       │ Epic 12: Main    │
│   + Storage eval │          └──────────────────┘       │   View           │
└──────────────────┘                                     └──────────────────┘
                                                              ↓ (9 before 12)
Phase 4 — Secondary           Epic 14: Testing            Phase 5 — Future
┌──────────────────┐          ┌──────────────────┐       ┌──────────────────┐
│ Epic 10: GDrive  │          │ (ongoing across  │       │ Epic 13: Side    │
│ Epic 11: Options │          │  all phases)     │       │   Panel explore  │
│   + Dedication   │          └──────────────────┘       └──────────────────┘
└──────────────────┘
```

**Key ordering constraints**:
- Epic 3 in Phase 1 because it's highest-risk — if existing trees can't be loaded, the project is dead
- Epic 0 includes react-arborist prototype — if Preact compat fails, eject to React before Phase 3
- Epic 9 must complete before Epic 12 (main view depends on context menu/keyboard)
- Epic 14 runs continuously, not as a final phase

---

## Reusable Abstractions (for other extensions)

1. **Chrome API Layer** (Epic 2) — Typed wrappers with port auto-reconnection. Any MV3 extension.
2. **Extension Messaging** (Epic 5/6) — Typed message protocol between service worker and views.
3. **WXT + Preact + TS Template** (Epic 0) — Project scaffold config.
4. **`useChromeStorage` Hook** (Epic 6) — Reactive chrome.storage wrapper.
5. **Tree Data Structure** (Epic 4, pure parts) — Generic tree operations. Outline tools, file managers, bookmark managers.

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Data migration breaks existing trees | Critical | Medium | Epic 3 first; round-trip tests; read-only old data; manual export safety net |
| react-arborist incompatible with Preact | High | Low | Prototype in Epic 0 with real tree interactions; eject to React via config change |
| Service worker termination loses state | High | Medium | `chrome.storage.session` + `chrome.alarms` heartbeat; startup reconstruction from persistent storage |
| Sleep bug (B1) only partially fixable | Medium | Medium | Heartbeat + `visibilitychange` + full re-sync — major improvement over zero-recovery status quo |
| react-arborist mutation model conflict | Medium | Medium | Use controlled/read-only mode; all mutations round-trip through SW; tree mirror updated on confirmation |
| Scope creep during migration | Medium | High | Strict priority tiers; very-low-priority features explicitly deferred |
| IndexedDB replacement (F1) introduces new bugs | Medium | Medium | Implement new storage alongside old; validate with round-trip tests before cutting over |

---

## AI Context Store Updates

### Add to `project-mapping-metadata.json`:

1. **`component-specification-workflow`** — currently tagged `frontend-proj` but not `tabs-outliner-revival`. This project will benefit from component specs for the tree view, context menu, and other components.

### Create (new files):

2. **Chrome extension development rule** (`rules/chrome-extension-patterns.md`) — MV3 patterns, service worker lifecycle, port management, storage patterns. Tag for `tabs-outliner-revival` and future extension projects.

### Suggested dev tools:

3. **Bundle analysis** — `rollup-plugin-visualizer` (Vite-compatible) for tracking extension size
4. **Chrome extension E2E testing** — Puppeteer with `chrome.debugger` for integration tests

---

## Verification

After each epic:

1. **Build**: `npm run build` succeeds with zero TS errors
2. **Tests**: `npm test` passes all unit/component tests
3. **Load**: Extension loads in Chrome as unpacked (`chrome://extensions`)
4. **Legacy**: Old extension in `legacy/` still loads independently
5. **Data**: (After Epic 3) Existing tree data loads correctly in new version
6. **Size**: `npm run build` output tracked with bundle analyzer — under 50KB target
7. **Memory**: Chrome task manager shows extension memory within acceptable range for 200-node tree

Final acceptance: Load new version, import existing tree, verify high-priority bugs (B1, B2, B4, B6) are resolved, verify B7 and F2 features work, navigate/drag/drop through the full tree.
