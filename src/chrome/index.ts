/**
 * Chrome API integration layer.
 *
 * Thin adapters over WXT's `browser.*` that add:
 * - Conversion to domain types (ChromeTabData, ChromeWindowData)
 * - Standardized error handling (ChromeApiError)
 * - Event listener cleanup utilities
 * - Port management with auto-reconnection
 */

export { ChromeApiError, withRetry } from './errors';
export type { RetryOptions } from './errors';

export {
  storageGet,
  storageSet,
  storageRemove,
  onStorageChanged,
} from './storage';

export {
  toChromeTabData,
  queryTabs,
  getTab,
  createTab,
  removeTab,
  updateTab,
  focusTab,
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onTabMoved,
  onTabAttached,
  onTabDetached,
  onTabActivated,
  onTabReplaced,
} from './tabs';

export {
  toChromeWindowData,
  queryWindows,
  getWindow,
  createWindow,
  removeWindow,
  updateWindow,
  focusWindow,
  onWindowCreated,
  onWindowRemoved,
  onWindowFocusChanged,
} from './windows';

export { getWorkArea } from './display';
export type { WorkArea } from './display';

export {
  setBadgeText,
  setBadgeColor,
  setTooltip,
  onActionClicked,
} from './action';

export { onCommand } from './commands';

export {
  getAuthToken,
  removeAuthToken,
  getProfileEmail,
} from './identity';

export { PortManager, onPortConnect } from './runtime';
export type { PortState, PortManagerOptions } from './runtime';

export {
  onExtensionInstalled,
  onExtensionStartup,
  onServiceWorkerSuspend,
} from './lifecycle';
