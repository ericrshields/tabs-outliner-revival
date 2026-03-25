/**
 * Typed storage helpers for AppSettings and the first-run flag.
 *
 * Settings are stored as a single merged object so adding new keys
 * with defaults never breaks existing stored data.
 */

import { storageGet, storageSet } from '@/chrome/storage';
import {
  SETTINGS_DEFAULTS,
  SETTINGS_KEY,
  DEDICATION_SEEN_KEY,
} from '@/types/settings';
import type { AppSettings } from '@/types/settings';

/** Load settings, merging stored values with defaults for any missing keys. */
export async function loadSettings(): Promise<AppSettings> {
  const stored = await storageGet<Partial<AppSettings>>(
    'local',
    SETTINGS_KEY,
    {},
  );
  return { ...SETTINGS_DEFAULTS, ...stored };
}

/**
 * Persist a partial settings update.
 * Performs a read-merge-write to avoid overwriting keys not in `partial`.
 */
export async function saveSettings(
  partial: Partial<AppSettings>,
): Promise<void> {
  const current = await loadSettings();
  await storageSet('local', { [SETTINGS_KEY]: { ...current, ...partial } });
}

/** Returns true if the user has already seen the dedication page. */
export async function getDedicationSeenFlag(): Promise<boolean> {
  return storageGet<boolean>('local', DEDICATION_SEEN_KEY, false);
}

/** Mark the dedication page as seen. */
export async function setDedicationSeenFlag(): Promise<void> {
  await storageSet('local', { [DEDICATION_SEEN_KEY]: true });
}
