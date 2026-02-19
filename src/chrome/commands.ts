/**
 * Keyboard command adapter.
 */

import { browser } from 'wxt/browser';

/** Listen for keyboard shortcuts defined in the manifest. */
export function onCommand(cb: (command: string) => void): () => void {
  browser.commands.onCommand.addListener(cb);
  return () => browser.commands.onCommand.removeListener(cb);
}
