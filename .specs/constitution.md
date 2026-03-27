# Tabs Outliner Revival — Project Constitution

<purpose>
Guiding principles for all development on Tabs Outliner Revival, a Chrome extension that manages browser tabs as a persistent, hierarchical tree.

**Context**: Reimplementation of Tabs Outliner (originally by Vladyslav Volovyk) using modern web extension tooling — Manifest V3, Preact, WXT, react-arborist. The extension preserves and organizes a user's browsing sessions as a tree of windows, tabs, groups, notes, and separators. Users depend on this tree as their persistent workspace — data loss is the worst possible failure mode.

**Authority**: This file is the supreme authority. When conflicts arise, constitution takes precedence over all other documentation.
</purpose>

---

## Core Values

These values are ranked. When two values conflict, the higher-ranked value wins.

### 1. Data Integrity First

**Principle**: User tree data must never be lost or corrupted.

**Rationale**: The tree is the user's persistent workspace — their mental model of open work, saved research, and organizational structure. Losing it is catastrophic and unrecoverable.

**Application**:
- All tree mutations go through `TreeModel` in the background service worker (single source of truth)
- Persist to `chrome.storage.local` after every mutation batch, with debounced writes
- Validate imported data: sanitize favicon URLs, verify node types
- Clear `active`/`focused` flags on all nodes at every startup and shutdown — not just on import. Prevents stale state from accumulating through any code path
- Never silently drop nodes — surface errors visibly rather than losing data quietly
- Test serialization round-trips: `serialize(deserialize(data))` must be lossless

### 2. Ephemeral Execution, Persistent State

**Principle**: Design every component to gracefully restart from persisted state.

**Rationale**: MV3 service workers terminate after ~30s of inactivity. Global variables are lost. The extension must recover seamlessly.

**Application**:
- No critical state lives only in memory — everything persists to `chrome.storage.local`
- Register all Chrome event listeners synchronously at service worker top level
- Dual keep-alive: 25s port heartbeat (while view is connected) + `chrome.alarms` (background-only)
- PortManager queues messages during disconnection, flushes on reconnect
- View re-fetches full tree state on reconnection — no assumption of continuity

### 3. Responsive UI

**Principle**: The tree view must feel instant.

**Rationale**: Users interact with this extension hundreds of times per day. Perceived latency erodes trust and breaks flow.

**Application**:
- Tree view open target: <100ms to first meaningful paint
- Smooth scrolling and interaction at 1,000+ nodes via react-arborist virtualization
- Mutations render incrementally — never re-render the full tree for a single node change
- Debounce expensive operations (persistence, stats recalculation) without blocking UI

### 4. User Data Ownership

**Principle**: All data stays local unless the user explicitly opts into sync.

**Rationale**: Browser history and tab organization are sensitive. Users must control where their data lives.

**Application**:
- Default storage is `chrome.storage.local` — no cloud, no telemetry, no analytics
- Google Drive backup (Epic 10) is opt-in, requires explicit OAuth consent
- No remote code execution, no external API calls except user-initiated GDrive sync
- Export formats (.tree, HTML) are user-readable and portable

### 5. Legacy Compatibility

**Principle**: Read and import original Tabs Outliner data formats without data loss.

**Rationale**: Users migrating from the original extension must not lose their tree. The migration path is a one-time but critical operation.

**Application**:
- Parse legacy IndexedDB (`TabsOutlinerDB34`) and migrate on first load
- Parse `text/html` `<li>/<ul>` structure from clipboard (Chrome blocks custom MIME types cross-extension)
- Import `.tree` files (complete path — clipboard DnD omits collapsed subtrees)
- Preserve legacy `colapsed` typo in serialization (data contract — cannot rename without breaking compatibility)
- Clear legacy `data.active` and `data.focused` flags on all imported nodes

### 6. Minimal Footprint

**Principle**: Keep the extension lightweight — small bundle, few dependencies, low memory.

**Rationale**: Extensions share the browser process. Every KB and every MB of RAM is borrowed from the user's browsing experience.

**Application**:
- Preact (~3 KB gzipped) over React (~40 KB)
- Targeted imports — no large utility libraries
- Virtualized rendering — only visible nodes in the DOM
- Lazy load non-critical paths (options page, import dialogs, dedication page)

---

## Non-Negotiable Constraints

These constraints are ABSOLUTE and NEVER negotiable:

### Architecture Constraints

1. **Background owns tree state**: All tree mutations go through `TreeModel` in the service worker. The view never mutates tree data directly.
2. **View is a read-only projection of tree data**: The view renders `NodeDTO` snapshots received from the background. Settings (via `use-chrome-storage`) may write directly to `chrome.storage`, but tree data flows one way: background → view.
3. **Typed message contracts**: Background→view messages discriminate on `command` (prefixed `msg2view_`). View→background messages discriminate on `request` (prefixed `request2bkg_`). Adding a new message requires updating the discriminated union type.
4. **Port-based communication with resilience**: `PortManager` provides auto-reconnection (exponential backoff 1–30s), 25s heartbeat, and message queuing during disconnection.
5. **chrome.storage.local for persistence**: Tree data and settings persist to `chrome.storage.local`. Never rely on in-memory-only state for anything the user expects to survive a browser restart.
6. **Synchronous event listener registration**: All Chrome event listeners in the service worker must register at the top level of `background.ts` — never inside async callbacks or conditional blocks.

### Code Quality Constraints

7. **TypeScript strict mode**: No `any` without explicit justification in a comment. No `@ts-ignore` or `@ts-expect-error` without a tracking comment.
8. **`as unknown as` casts only at serialization boundaries**: Accepted in entry-codec, hierarchy-jso, knot-resolver, operations-codec, and TreeNode serialize/deserialize. Prohibited elsewhere.
9. **vitest + tsc --noEmit + build must pass before commit**: No exceptions.
10. **Sanitize all imported data**: Favicon URLs filtered through `sanitizeIconUrl()`. Node types validated.
11. **Clear `active`/`focused` on startup and shutdown**: Every saved node's `active` and `focused` flags reset on service worker init and before persist. Eliminates stale state regardless of source.

### WXT / Extension Constraints

12. **WXT conventions**: File-based entrypoint discovery. No shared code directly in `entrypoints/`. Shared code lives in `src/`.
13. **No remote code execution**: All code bundled in the extension package. No `eval()`, no remote script loading, no `dangerouslySetInnerHTML` without sanitization.
14. **Legacy serialization contract**: The `colapsed` field name (typo) is a data contract. Cannot rename without breaking deserialization of existing user data.

### Security Constraints

15. **No data exfiltration**: No analytics, no telemetry, no external network calls except user-initiated GDrive sync.
16. **Content Security Policy**: Strict CSP with no inline scripts. Enforced by manifest and WXT config.
17. **Sanitize tab titles against prompt/agent injection**: Tab titles are user-controlled and rendered in the tree UI, but they also flow through AI-assisted development tooling (Claude Code, etc.) via screenshots, logs, and test output. Malicious tab titles containing LLM directives (e.g., "Ignore previous instructions...", `<system>`, `[INST]`, prompt-like patterns referencing AI/LLM/Claude/GPT) must be escaped or stripped before rendering in any context where they could be interpreted as instructions. Apply a sanitization pass that neutralizes common injection patterns — HTML-escape angle brackets, strip or escape known prompt delimiters, and flag titles matching suspicious patterns for review.

---

## Quality Attributes

Ranked by priority for this project:

1. **Reliability** — The extension must not lose data, crash, or leave the user in a broken state
2. **Performance** — UI interactions must feel instant; background operations must not block the browser
3. **Maintainability** — Code must be understandable and modifiable by a single developer
4. **Testability** — Critical paths (serialization, tree mutations, migrations) must have unit test coverage
5. **Features** — New capabilities are valuable only when the above attributes are maintained

---

## Scope Boundaries

This project deliberately does NOT:

- **Replace browser tab management** — it supplements it. Chrome's native tab strip remains primary.
- **Sync across devices** — local-only by default. GDrive backup (Epic 10) is file-based export/import, not real-time sync.
- **Support Firefox/Safari** — Chrome-only for v1. WXT enables future cross-browser support but it is not a current goal.
- **Provide a web clipper or content extraction** — nodes reference tabs by URL, they don't store page content.
- **Implement collaborative features** — single-user, single-browser.
- **Add AI/LLM features** — no AI-powered organization, tab suggestions, summarization, or content analysis. The extension is a deterministic tool, not an intelligent assistant.

---

## Decision Hierarchy

When conflicts arise, follow this priority order:

1. **Constitution** (this file) — Immutable principles
2. **Architecture** (`.specs/architecture.md`) — System design constraints
3. **Project Summary** (`.claude/project-summary.md`) — Current state and conventions
4. **Modernization Plan** (`docs/modernization-plan.md`) — Epic roadmap and tech rationale

---

## Exception Process

When constraints must be violated:

1. **Document justification**: Why is the exception necessary?
2. **Assess risk**: What could go wrong? What data could be lost?
3. **Mitigate**: What safeguards are in place?
4. **Track**: Add a comment at the violation site referencing the justification
5. **Review**: Exceptions to data integrity or security constraints require explicit user approval

---

**Last Updated**: 2026-03-27
**Applies To**: All Tabs Outliner Revival development
**Related**: [architecture.md](architecture.md), [../../.claude/project-summary.md](../../.claude/project-summary.md), [../../docs/modernization-plan.md](../../docs/modernization-plan.md)
