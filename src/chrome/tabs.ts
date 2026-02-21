/**
 * Tab adapter — converts between Chrome API types and domain types.
 *
 * All query/CRUD functions return `ChromeTabData` (our persisted subset).
 * Event subscriptions return cleanup functions.
 */

import { browser } from 'wxt/browser';
import type { ChromeTabData } from '@/types/chrome';
import { ChromeApiError } from './errors';

/** Extract the fields we persist from a native Chrome tab. */
export function toChromeTabData(tab: Browser.tabs.Tab): ChromeTabData {
  return {
    id: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    status: tab.status,
    pinned: tab.pinned,
    incognito: tab.incognito,
    active: tab.active,
    highlighted: tab.highlighted,
  };
}

export async function queryTabs(
  queryInfo: Browser.tabs.QueryInfo,
): Promise<ChromeTabData[]> {
  try {
    const tabs = await browser.tabs.query(queryInfo);
    return tabs.map(toChromeTabData);
  } catch (err) {
    throw new ChromeApiError('Failed to query tabs', 'tabs.query', err);
  }
}

export async function getTab(tabId: number): Promise<ChromeTabData | null> {
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab) return null;
    return toChromeTabData(tab);
  } catch (err) {
    if (err instanceof Error && /no tab/i.test(err.message)) {
      return null;
    }
    throw new ChromeApiError('Failed to get tab', 'tabs.get', err);
  }
}

export async function createTab(
  props: Browser.tabs.CreateProperties,
): Promise<ChromeTabData> {
  try {
    const tab = await browser.tabs.create(props);
    return toChromeTabData(tab);
  } catch (err) {
    throw new ChromeApiError('Failed to create tab', 'tabs.create', err);
  }
}

export async function removeTab(tabId: number): Promise<void> {
  try {
    await browser.tabs.remove(tabId);
  } catch (err) {
    throw new ChromeApiError('Failed to remove tab', 'tabs.remove', err);
  }
}

export async function updateTab(
  tabId: number,
  props: Browser.tabs.UpdateProperties,
): Promise<ChromeTabData> {
  let tab: Browser.tabs.Tab | undefined;
  try {
    tab = await browser.tabs.update(tabId, props);
  } catch (err) {
    throw new ChromeApiError('Failed to update tab', 'tabs.update', err);
  }
  if (!tab) throw new ChromeApiError('Tab not found after update', 'tabs.update');
  return toChromeTabData(tab);
}

/** Activate a tab and focus its window. */
export async function focusTab(
  tabId: number,
  windowId: number,
): Promise<void> {
  try {
    await browser.tabs.update(tabId, { active: true });
  } catch (err) {
    throw new ChromeApiError('Failed to activate tab', 'tabs.update', err);
  }
  try {
    await browser.windows.update(windowId, { focused: true });
  } catch (err) {
    throw new ChromeApiError('Failed to focus window', 'windows.update', err);
  }
}

// --- Event subscriptions (each returns a cleanup function) ---

export function onTabCreated(
  cb: (tab: ChromeTabData) => void,
): () => void {
  const listener = (tab: Browser.tabs.Tab) => cb(toChromeTabData(tab));
  browser.tabs.onCreated.addListener(listener);
  return () => browser.tabs.onCreated.removeListener(listener);
}

export function onTabRemoved(
  cb: (
    tabId: number,
    removeInfo: { windowId: number; isWindowClosing: boolean },
  ) => void,
): () => void {
  browser.tabs.onRemoved.addListener(cb);
  return () => browser.tabs.onRemoved.removeListener(cb);
}

export function onTabUpdated(
  cb: (
    tabId: number,
    changeInfo: Browser.tabs.OnUpdatedInfo,
    tab: ChromeTabData,
  ) => void,
): () => void {
  const listener = (
    tabId: number,
    changeInfo: Browser.tabs.OnUpdatedInfo,
    tab: Browser.tabs.Tab,
  ) => cb(tabId, changeInfo, toChromeTabData(tab));
  browser.tabs.onUpdated.addListener(listener);
  return () => browser.tabs.onUpdated.removeListener(listener);
}

export function onTabMoved(
  cb: (tabId: number, moveInfo: Browser.tabs.OnMovedInfo) => void,
): () => void {
  browser.tabs.onMoved.addListener(cb);
  return () => browser.tabs.onMoved.removeListener(cb);
}

export function onTabAttached(
  cb: (tabId: number, attachInfo: Browser.tabs.OnAttachedInfo) => void,
): () => void {
  browser.tabs.onAttached.addListener(cb);
  return () => browser.tabs.onAttached.removeListener(cb);
}

export function onTabDetached(
  cb: (tabId: number, detachInfo: Browser.tabs.OnDetachedInfo) => void,
): () => void {
  browser.tabs.onDetached.addListener(cb);
  return () => browser.tabs.onDetached.removeListener(cb);
}

export function onTabActivated(
  cb: (activeInfo: Browser.tabs.OnActivatedInfo) => void,
): () => void {
  browser.tabs.onActivated.addListener(cb);
  return () => browser.tabs.onActivated.removeListener(cb);
}
