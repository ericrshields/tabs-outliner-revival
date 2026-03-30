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
