/**
 * Chrome alarms adapter — typed wrappers around chrome.alarms API.
 *
 * Used by the service worker keep-alive system (MV3 replacement for
 * the legacy internal-port hack).
 */

import { browser } from 'wxt/browser';

/** Create a repeating alarm. */
export function createAlarm(name: string, periodInMinutes: number): void {
  browser.alarms.create(name, { periodInMinutes });
}

/** Listen for a specific alarm firing. Returns cleanup function. */
export function onAlarm(name: string, cb: () => void): () => void {
  const listener = (alarm: Browser.alarms.Alarm) => {
    if (alarm.name === name) {
      cb();
    }
  };
  browser.alarms.onAlarm.addListener(listener);
  return () => browser.alarms.onAlarm.removeListener(listener);
}

/** Clear a specific alarm. */
export async function clearAlarm(name: string): Promise<void> {
  await browser.alarms.clear(name);
}
