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
