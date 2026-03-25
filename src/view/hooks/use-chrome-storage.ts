/**
 * Reactive hook for a single chrome.storage key.
 *
 * Loads the current value on mount, subscribes to changes, and provides
 * an optimistic setter that updates local state immediately.
 */

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, onStorageChanged } from '@/chrome/storage';

type StorageArea = 'local' | 'sync' | 'session';

/**
 * Bind a component to a single chrome.storage key.
 *
 * @param area         Storage area ('local', 'sync', or 'session')
 * @param key          Storage key to watch
 * @param defaultValue Fallback when the key is absent.
 *                     Must be a stable reference (primitive or memoized) —
 *                     passing an inline object/array literal causes the effects
 *                     to re-subscribe on every render.
 * @returns [currentValue, setValue]
 */
export function useChromeStorage<T>(
  area: StorageArea,
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // Load initial value on mount (or when area/key/defaultValue changes)
  useEffect(() => {
    let cancelled = false;
    void storageGet<T>(area, key, defaultValue).then((stored) => {
      if (!cancelled) setValue(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [area, key, defaultValue]);

  // Subscribe to external changes (e.g. background broadcast triggering re-read)
  useEffect(() => {
    const cleanup = onStorageChanged(area, key, (newValue) => {
      setValue(newValue !== undefined ? (newValue as T) : defaultValue);
    });
    return cleanup;
  }, [area, key, defaultValue]);

  const set = useCallback(
    (newValue: T) => {
      setValue(newValue);
      void storageSet(area, { [key]: newValue });
    },
    [area, key],
  );

  return [value, set];
}
