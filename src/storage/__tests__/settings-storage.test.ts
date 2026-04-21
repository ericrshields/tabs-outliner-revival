import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  loadSettings,
  saveSettings,
  getDedicationSeenFlag,
  setDedicationSeenFlag,
} from '../settings-storage';
import { SETTINGS_DEFAULTS } from '@/types/settings';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', async () => {
    const settings = await loadSettings();
    expect(settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('merges stored values with defaults', async () => {
    await saveSettings({ autoScrollToTab: true });
    const settings = await loadSettings();
    expect(settings.autoScrollToTab).toBe(true);
    // Other keys still have defaults
    expect(settings.openOnStartup).toBe(false);
    expect(settings.oneClickToOpen).toBe(false);
    expect(settings.lightBackground).toBe(false);
  });

  it('handles partial stored object (missing keys get defaults)', async () => {
    // Simulate storage containing only some keys (e.g. from an older version)
    await fakeBrowser.storage.local.set({
      tabs_outliner_settings: { oneClickToOpen: true },
    });
    const settings = await loadSettings();
    expect(settings.oneClickToOpen).toBe(true);
    expect(settings.autoScrollToTab).toBe(false);
    expect(settings.openOnStartup).toBe(false);
    expect(settings.lightBackground).toBe(false);
  });
});

describe('saveSettings', () => {
  it('persists a single setting', async () => {
    await saveSettings({ lightBackground: true });
    const settings = await loadSettings();
    expect(settings.lightBackground).toBe(true);
  });

  it('does not overwrite other keys', async () => {
    await saveSettings({ autoScrollToTab: true });
    await saveSettings({ openOnStartup: true });
    const settings = await loadSettings();
    // Both keys should be set
    expect(settings.autoScrollToTab).toBe(true);
    expect(settings.openOnStartup).toBe(true);
  });

  it('round-trips all settings', async () => {
    const updates = {
      autoScrollToTab: true,
      openOnStartup: true,
      oneClickToOpen: true,
      lightBackground: true,
      wrapImportsInContainer: false,
    };
    await saveSettings(updates);
    const loaded = await loadSettings();
    expect(loaded).toEqual(updates);
  });
});

describe('getDedicationSeenFlag / setDedicationSeenFlag', () => {
  it('returns false when flag is not set', async () => {
    expect(await getDedicationSeenFlag()).toBe(false);
  });

  it('returns true after setting the flag', async () => {
    await setDedicationSeenFlag();
    expect(await getDedicationSeenFlag()).toBe(true);
  });

  it('flag persists across multiple reads', async () => {
    await setDedicationSeenFlag();
    expect(await getDedicationSeenFlag()).toBe(true);
    expect(await getDedicationSeenFlag()).toBe(true);
  });
});
