/**
 * Browser action adapter — badge, tooltip, and click handler.
 */

import { browser } from 'wxt/browser';
import type { ChromeTabData } from '../types/chrome';
import { ChromeApiError } from './errors';
import { toChromeTabData } from './tabs';

export async function setBadgeText(text: string): Promise<void> {
  try {
    await browser.action.setBadgeText({ text });
  } catch (err) {
    throw new ChromeApiError(
      'Failed to set badge text',
      'action.setBadgeText',
      err,
    );
  }
}

export async function setBadgeColor(color: string): Promise<void> {
  try {
    await browser.action.setBadgeBackgroundColor({ color });
  } catch (err) {
    throw new ChromeApiError(
      'Failed to set badge color',
      'action.setBadgeBackgroundColor',
      err,
    );
  }
}

export async function setTooltip(title: string): Promise<void> {
  try {
    await browser.action.setTitle({ title });
  } catch (err) {
    throw new ChromeApiError(
      'Failed to set tooltip',
      'action.setTitle',
      err,
    );
  }
}

export function onActionClicked(
  cb: (tab: ChromeTabData) => void,
): () => void {
  const listener = (tab: Browser.tabs.Tab) => cb(toChromeTabData(tab));
  browser.action.onClicked.addListener(listener);
  return () => browser.action.onClicked.removeListener(listener);
}
