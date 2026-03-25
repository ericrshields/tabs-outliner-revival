# Tabs Outliner Revival — v1 Manual Smoke Test Checklist

> **When to run**: Before every release candidate and before v1 ship.
> **Setup**: Load the extension as unpacked from `.output/chrome-mv3/`. Open a Chrome window with 3–4 tabs across 2 windows. Have a `.tree` backup file handy for import testing.
>
> **Release blocking**: Any failure in sections 1–11 is a release blocker unless explicitly noted as a known issue in the Notes column. Section 12 is N/A until Epic 12 ships.

---

## 1. First-Run Experience

- [ ] **First install**: Opening the extension shows the import/welcome modal overlay
- [ ] **Dedication page**: A separate dedication page window opens automatically on first install
- [ ] **Import via .tree file**: "Choose .tree File" button opens file picker; selecting a `.tree` file imports the tree successfully and shows "Imported N nodes"
- [ ] **Import via drag-and-drop**: *(Requires original Tabs Outliner extension installed)* Dragging tree content from original Tabs Outliner into the drop zone imports successfully
- [ ] **Skip import**: "Skip — start fresh" dismisses the modal and shows an empty tree
- [ ] **No re-show**: Reloading the extension after completing first-run does not show the modal again

---

## 2. Tree View

### Node Display
- [ ] **Active windows**: Open Chrome windows appear as parent nodes
- [ ] **Active tabs**: Tabs within each window appear as children with correct title and favicon
- [ ] **Focused window / selected tab**: Active window and focused tab have distinct visual styling
- [ ] **Saved nodes**: Imported/saved tabs and windows display with visually distinct (non-active) styling
- [ ] **Groups and separators**: Groups show folder-style icon; separators render as text dividers
- [ ] **Text notes**: Existing notes display with `#` prefix *(note creation from UI ships in beta.2)*
- [ ] **Collapse indicator**: Nodes with children show ▶ (collapsed) or ▼ (expanded)

### Sync With Chrome
- [ ] **New tab opens**: Opening a new tab in Chrome adds it to the correct window node in the tree
- [ ] **Tab closed**: Closing a tab in Chrome removes it from the tree
- [ ] **Protected tab retained**: A tab with child nodes or custom marks converts to a saved node instead of being removed when closed in Chrome
- [ ] **Window closed**: Closing a Chrome window removes its node from the tree
- [ ] **Tab activated**: Clicking a tab node in the tree activates it in Chrome
- [ ] **Window activated**: Clicking a window node in the tree brings that window to focus

---

## 3. Context Menu

Right-click a node to open the context menu.

- [ ] **Menu appears**: Context menu opens positioned near the click, clamped within viewport
- [ ] **Escape closes**: Pressing Escape closes the menu
- [ ] **Click outside closes**: Clicking anywhere outside the menu closes it

#### Clipboard
- [ ] **Cut (Ctrl+X)**: Cuts node; first Ctrl+V moves it to the next sibling position; second Ctrl+V is a no-op (clipboard cleared after cut-paste)
- [ ] **Copy (Ctrl+C)**: Copies node; multiple Ctrl+V presses each insert a new copy (clipboard persists)
- [ ] **Paste (Ctrl+V)**: Pastes at the next sibling position; menu item is disabled when clipboard is empty

#### Node Actions
- [ ] **Edit (F2)**: Opens inline edit input for the node's title/text
- [ ] **Save & Close (Backspace)**: Closes an active tab/window and retains it as a saved node
- [ ] **Restore (o)**: Opens a saved tab/window in the browser
- [ ] **Delete (Del)**: Removes the node from the tree

#### Movement
- [ ] **Move Up (Ctrl+↑)**: Moves node up one position; disabled at position 0
- [ ] **Move Down (Ctrl+↓)**: Moves node down one position; disabled at last position
- [ ] **Indent (Ctrl+→)**: Makes node a child of its previous sibling; disabled when no valid sibling
- [ ] **Outdent (Ctrl+←)**: Moves node up one level; disabled when parent is root
- [ ] **To First (Ctrl+Home)**: Moves node to first sibling position
- [ ] **To Last (Ctrl+End)**: Moves node to last sibling position

#### Collapse / Expand
- [ ] **Collapse**: Container nodes (windows, groups) with children show Collapse option
- [ ] **Expand**: Collapsed container nodes show Expand option

---

## 4. Keyboard Shortcuts

> All shortcuts should be **blocked while an inline edit input is focused**.

- [ ] **Ctrl+X / Ctrl+C / Ctrl+V**: Cut, copy, paste (same behavior as context menu)
- [ ] **Ctrl+↑ / ↓ / → / ←**: Move in all four directions
- [ ] **Ctrl+Home / Ctrl+End**: Move to first / last sibling
- [ ] **Del**: Delete selected node
- [ ] **Backspace**: Save & close active node
- [ ] **F2**: Open inline edit
- [ ] **o**: Restore/activate saved node
- [ ] **-**: Toggle collapse on container node
- [ ] **Escape**: Close open context menu

---

## 5. Inline Editing

- [ ] **F2 activates**: Edit input appears with the current node text pre-filled and focused
- [ ] **Enter commits**: Pressing Enter saves the new title
- [ ] **Blur commits**: Clicking outside the input saves the new title
- [ ] **Escape cancels**: Pressing Escape discards changes and closes input
- [ ] **Separator F2 cycles**: For separators, F2 cycles through the three styles (`---` dashes → `===` equals → `-=` alternating) instead of opening a text input
- [ ] **Shortcuts suppressed**: While editing, movement/action shortcuts do not fire

---

## 6. Hovering Menu

- [ ] **Appears on hover**: Hovering over a node shows action buttons at the row's right edge
- [ ] **Close button (✕)**: Visible for active tabs/windows; clicking triggers save & close
- [ ] **Delete button (🗑)**: Visible for deletable nodes; clicking deletes the node

---

## 7. Drag and Drop

- [ ] **Reorder siblings**: Dragging a node to a new position among its siblings moves it
- [ ] **Nest into node**: Dragging a node onto another makes it a child
- [ ] **Drop indicator**: A blue indicator line shows the prospective drop position during drag
- [ ] **Cancel drag**: Releasing drag with no valid target leaves the tree unchanged

---

## 8. Export

- [ ] **Export .tree**: Clicking "Export .tree" in the toolbar triggers a browser download of a `.tree` file
- [ ] **Export .html**: Clicking "Export .html" triggers a browser download of an HTML outline file
- [ ] **HTML content**: Opened in a browser, the HTML file renders the tree as a readable nested list
- [ ] **Export → import roundtrip**: Export the current tree as `.tree`, clear the tree (or reinstall), import the exported file, verify node count and structure match the original

---

## 9. Options Page

Open via the gear/settings link or `chrome-extension://.../options.html`.

- [ ] **Auto-scroll to tab**: Toggling saves immediately; setting persists after reload
- [ ] **Open on startup**: Toggling saves immediately; setting persists after reload
- [ ] **One-click to open**: Toggling saves immediately; setting persists after reload
- [ ] **Light background**: Toggling saves and applies visual theme; persists after reload
- [ ] **Google Drive placeholder**: Backup section shows "coming in a future update" and is visually disabled
- [ ] **Version in About**: About section shows correct version string (e.g., `2.0.0-beta.x`)
- [ ] **GitHub link**: Link opens the correct repo URL in a new tab

---

## 10. Dedication Page

Open via `chrome-extension://.../dedication.html` (or trigger first-run install).

- [ ] **Content renders**: Ukrainian flag badge, original author credit, and revival context all display
- [ ] **Close button**: Clicking "Close" closes the window
- [ ] **Version footer**: Version string at the bottom matches the manifest

---

## 11. Persistence & Reconnection

- [ ] **Tree persists**: After reloading the extension popup (or reopening), the tree is restored as saved
- [ ] **Collapse state persists**: Collapsed nodes remain collapsed after reload
- [ ] **Port reconnect banner**: Go to `chrome://extensions`, disable then re-enable the extension, then reopen the tree view — the reconnecting banner should briefly appear and then disappear once the port reconnects
- [ ] **Tree re-syncs after reconnect**: After reconnection, the tree accurately reflects the current open tabs/windows

---

## 12. Main View Toolbar *(Epic 12 — N/A until beta.2)*

> Not yet implemented. Fill in this section when Epic 12 ships. Skip during rc.0 smoke test if Epic 12 is still pending.

- [ ] **New Window button**: Creates a new saved window node at the root level
- [ ] **New Group button**: Creates a new group node at the cursor position
- [ ] **New Separator button**: Creates a separator node at the cursor position
- [ ] **Info / Help / Settings links**: Each link opens the correct page

---

## 13. Edge Cases

- [ ] **Very long tab title**: Long titles truncate or wrap without breaking the layout
- [ ] **Special characters in title**: Titles with `<`, `>`, `&`, `"` render as literal text (not HTML entities)
- [ ] **Empty tree**: With no nodes, the tree view renders without errors
- [ ] **Rapid cut + paste**: Cut a node, paste it twice rapidly — first paste moves it; second paste is a no-op; node count is unchanged and the node is at the pasted position
- [ ] **Move at boundaries**: Moving a node already at position 0 up (or last node down) does nothing

---

## Sign-Off

| Area | Tester | Date | Pass/Fail | Notes |
|------|--------|------|-----------|-------|
| First-Run | | | | |
| Tree View | | | | |
| Context Menu | | | | |
| Keyboard Shortcuts | | | | |
| Inline Editing | | | | |
| Hovering Menu | | | | |
| Drag and Drop | | | | |
| Export | | | | |
| Options Page | | | | |
| Dedication Page | | | | |
| Persistence & Reconnect | | | | |
| Main View Toolbar | N/A | — | N/A | Epic 12 not yet shipped |
| Edge Cases | | | | |
