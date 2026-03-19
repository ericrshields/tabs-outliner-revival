/**
 * Window adapter — converts between Chrome API types and domain types.
 *
 * All query/CRUD functions return `ChromeWindowData` (our persisted subset).
 * Event subscriptions return cleanup functions.
 */

import { browser } from 'wxt/browser';
import type {
  ChromeTabData,
  ChromeWindowData,
  ChromeWindowType,
} from '@/types/chrome';
import { ChromeApiError } from './errors';

/** Extract the fields we persist from a native Chrome window. */
export function toChromeWindowData(
  win: Browser.windows.Window,
): ChromeWindowData {
  return {
    id: win.id,
    type: win.type as ChromeWindowType | undefined,
    incognito: win.incognito,
    alwaysOnTop: win.alwaysOnTop,
    focused: win.focused,
    rect:
      win.top != null &&
      win.left != null &&
      win.width != null &&
      win.height != null
        ? { top: win.top, left: win.left, width: win.width, height: win.height }
        : undefined,
  };
}

export async function queryWindows(
  queryInfo?: Browser.windows.QueryOptions,
): Promise<ChromeWindowData[]> {
  try {
    const wins = await browser.windows.getAll(queryInfo ?? {});
    return wins.map(toChromeWindowData);
  } catch (err) {
    throw new ChromeApiError('Failed to query windows', 'windows.getAll', err);
  }
}

export async function getWindow(
  windowId: number,
): Promise<ChromeWindowData | null> {
  try {
    const win = await browser.windows.get(windowId);
    if (!win) return null;
    return toChromeWindowData(win);
  } catch (err) {
    if (err instanceof Error && /no window/i.test(err.message)) {
      return null;
    }
    throw new ChromeApiError('Failed to get window', 'windows.get', err);
  }
}

export async function createWindow(
  props: Browser.windows.CreateData,
): Promise<ChromeWindowData> {
  let win: Browser.windows.Window | undefined;
  try {
    win = await browser.windows.create(props);
  } catch (err) {
    throw new ChromeApiError('Failed to create window', 'windows.create', err);
  }
  if (!win)
    throw new ChromeApiError(
      'Window not returned after create',
      'windows.create',
    );
  return toChromeWindowData(win);
}

/**
 * Create a new Chrome window containing the given URL as its first tab.
 * Returns the tab data for that first tab.
 *
 * Use this when there is no existing window to target — e.g., when
 * restoring a saved tab whose parent window no longer exists.
 */
export async function createWindowWithUrl(url: string): Promise<ChromeTabData> {
  let win: Browser.windows.Window | undefined;
  try {
    win = await browser.windows.create({ url });
  } catch (err) {
    throw new ChromeApiError('Failed to create window', 'windows.create', err);
  }
  if (!win)
    throw new ChromeApiError(
      'Window not returned after create',
      'windows.create',
    );
  const tab = win.tabs?.[0];
  if (!tab)
    throw new ChromeApiError('No tab returned in new window', 'windows.create');
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

export async function removeWindow(windowId: number): Promise<void> {
  try {
    await browser.windows.remove(windowId);
  } catch (err) {
    throw new ChromeApiError('Failed to remove window', 'windows.remove', err);
  }
}

export async function updateWindow(
  windowId: number,
  props: Browser.windows.UpdateInfo,
): Promise<ChromeWindowData> {
  try {
    const win = await browser.windows.update(windowId, props);
    return toChromeWindowData(win);
  } catch (err) {
    throw new ChromeApiError('Failed to update window', 'windows.update', err);
  }
}

/** Bring a window to the front. */
export async function focusWindow(windowId: number): Promise<void> {
  try {
    await browser.windows.update(windowId, { focused: true });
  } catch (err) {
    throw new ChromeApiError('Failed to focus window', 'windows.update', err);
  }
}

// --- Event subscriptions (each returns a cleanup function) ---

export function onWindowCreated(
  cb: (win: ChromeWindowData) => void,
): () => void {
  const listener = (win: Browser.windows.Window) => cb(toChromeWindowData(win));
  browser.windows.onCreated.addListener(listener);
  return () => browser.windows.onCreated.removeListener(listener);
}

export function onWindowRemoved(cb: (windowId: number) => void): () => void {
  browser.windows.onRemoved.addListener(cb);
  return () => browser.windows.onRemoved.removeListener(cb);
}

export function onWindowFocusChanged(
  cb: (windowId: number) => void,
): () => void {
  browser.windows.onFocusChanged.addListener(cb);
  return () => browser.windows.onFocusChanged.removeListener(cb);
}
