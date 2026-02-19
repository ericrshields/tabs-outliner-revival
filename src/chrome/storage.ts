/**
 * Typed storage utilities wrapping browser.storage.
 *
 * Provides get/set/remove with type parameters and change listeners
 * that return cleanup functions.
 */

import { browser } from 'wxt/browser';
import { ChromeApiError } from './errors';

type StorageAreaName = 'local' | 'sync' | 'session';

function getArea(area: StorageAreaName): Browser.storage.StorageArea {
  return browser.storage[area];
}

/** Get a single value from storage, returning `fallback` when the key is absent. */
export async function storageGet<T>(
  area: StorageAreaName,
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const result = await getArea(area).get(key);
    return result[key] !== undefined ? (result[key] as T) : fallback;
  } catch (err) {
    throw new ChromeApiError(
      `Failed to get "${key}" from storage.${area}`,
      `storage.${area}.get`,
      err,
    );
  }
}

/** Set one or more key-value pairs in storage. */
export async function storageSet(
  area: StorageAreaName,
  items: Record<string, unknown>,
): Promise<void> {
  try {
    await getArea(area).set(items);
  } catch (err) {
    throw new ChromeApiError(
      `Failed to set keys in storage.${area}`,
      `storage.${area}.set`,
      err,
    );
  }
}

/** Remove one or more keys from storage. */
export async function storageRemove(
  area: StorageAreaName,
  keys: string | string[],
): Promise<void> {
  try {
    await getArea(area).remove(keys);
  } catch (err) {
    throw new ChromeApiError(
      `Failed to remove keys from storage.${area}`,
      `storage.${area}.remove`,
      err,
    );
  }
}

/**
 * Listen for changes to a specific key in a storage area.
 * Returns a cleanup function that removes the listener.
 */
export function onStorageChanged(
  area: StorageAreaName,
  key: string,
  callback: (newValue: unknown, oldValue: unknown) => void,
): () => void {
  const listener = (
    changes: Record<string, Browser.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName === area && key in changes) {
      const change = changes[key];
      callback(change.newValue, change.oldValue);
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
