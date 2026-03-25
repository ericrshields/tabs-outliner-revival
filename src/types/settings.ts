/**
 * Application settings — stored as a single object in chrome.storage.local.
 */

export interface AppSettings {
  /** Auto-scroll the tree to the currently active tab. */
  autoScrollToTab: boolean;
  /** Open the tree tab automatically when the browser starts. */
  openOnStartup: boolean;
  /** Open saved tabs with a single click instead of double-click. */
  oneClickToOpen: boolean;
  /** Use a light background theme instead of dark. */
  lightBackground: boolean;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  autoScrollToTab: false,
  openOnStartup: false,
  oneClickToOpen: false,
  lightBackground: false,
};

/** chrome.storage.local key for persisted AppSettings. */
export const SETTINGS_KEY = 'tabs_outliner_settings';

/** chrome.storage.local key for the first-run dedication page flag. */
export const DEDICATION_SEEN_KEY = 'dedication_seen';
