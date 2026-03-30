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
