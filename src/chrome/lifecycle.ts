/**
 * Service worker lifecycle hooks.
 */

import { browser } from 'wxt/browser';

/** Fires when the extension is first installed, updated, or Chrome is updated. */
export function onExtensionInstalled(
  cb: (details: Browser.runtime.InstalledDetails) => void,
): () => void {
  browser.runtime.onInstalled.addListener(cb);
  return () => browser.runtime.onInstalled.removeListener(cb);
}

/** Fires when a profile that has this extension installed first starts up. */
export function onExtensionStartup(cb: () => void): () => void {
  browser.runtime.onStartup.addListener(cb);
  return () => browser.runtime.onStartup.removeListener(cb);
}

/** Fires just before the service worker is suspended. Use for cleanup. */
export function onServiceWorkerSuspend(cb: () => void): () => void {
  browser.runtime.onSuspend.addListener(cb);
  return () => browser.runtime.onSuspend.removeListener(cb);
}
