import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  toChromeTabData,
  queryTabs,
  getTab,
  createTab,
  removeTab,
  updateTab,
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
} from '../tabs';
import { ChromeApiError } from '../errors';
import type { ChromeTabData } from '@/types/chrome';

describe('tabs', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('toChromeTabData', () => {
    it('extracts only the persisted fields', () => {
      const chromeTab = {
        id: 1,
        index: 0,
        windowId: 10,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/favicon.ico',
        status: 'complete',
        pinned: false,
        incognito: false,
        active: true,
        highlighted: true,
        audible: true,
        mutedInfo: { muted: false },
      } as Browser.tabs.Tab;

      const result = toChromeTabData(chromeTab);

      expect(result).toEqual({
        id: 1,
        windowId: 10,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/favicon.ico',
        status: 'complete',
        pinned: false,
        incognito: false,
        active: true,
        highlighted: true,
      });

      expect(result).not.toHaveProperty('audible');
      expect(result).not.toHaveProperty('mutedInfo');
      expect(result).not.toHaveProperty('index');
    });

    it('handles undefined optional fields', () => {
      const chromeTab = { id: 2, index: 0 } as Browser.tabs.Tab;
      const result = toChromeTabData(chromeTab);
      expect(result.id).toBe(2);
      expect(result.url).toBeUndefined();
      expect(result.title).toBeUndefined();
    });
  });

  describe('queryTabs', () => {
    it('returns domain-typed tabs with created URLs', async () => {
      await fakeBrowser.tabs.create({ url: 'https://a.com' });
      await fakeBrowser.tabs.create({ url: 'https://b.com' });

      const tabs = await queryTabs({});
      const urls = tabs.map((t) => t.url);
      expect(urls).toContain('https://a.com');
      expect(urls).toContain('https://b.com');
      for (const tab of tabs) {
        expect(tab).not.toHaveProperty('index');
      }
    });
  });

  describe('getTab', () => {
    it('returns the tab when it exists', async () => {
      const created = await fakeBrowser.tabs.create({ url: 'https://test.com' });
      const tab = await getTab(created.id!);
      expect(tab).not.toBeNull();
      expect(tab!.id).toBe(created.id);
    });

    it('returns null for nonexistent tab', async () => {
      const tab = await getTab(999999);
      expect(tab).toBeNull();
    });
  });

  describe('createTab', () => {
    it('creates a tab and returns domain type', async () => {
      const tab = await createTab({ url: 'https://new.com' });
      expect(tab.url).toBe('https://new.com');
      expect(tab.id).toBeDefined();
      expect(tab).not.toHaveProperty('index');
    });
  });

  describe('removeTab', () => {
    // fakeBrowser has an internal bug in tabs.remove (crashes reading .id of undefined)
    // and silently resolves for nonexistent tab IDs, so we mock the underlying API
    // to test our error-wrapping behavior.

    it('calls browser.tabs.remove with the given id', async () => {
      // Just verify our adapter forwards the call — don't rely on fakeBrowser's
      // buggy remove implementation
      const created = await fakeBrowser.tabs.create({ url: 'https://del.com' });
      const id = created.id!;

      // Spy on the underlying call
      const spy = vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined);
      await removeTab(id);
      expect(spy).toHaveBeenCalledWith(id);
      spy.mockRestore();
    });

    it('throws ChromeApiError when the API rejects', async () => {
      const spy = vi
        .spyOn(fakeBrowser.tabs, 'remove')
        .mockRejectedValue(new Error('No tab with id: 999999'));
      await expect(removeTab(999999)).rejects.toBeInstanceOf(ChromeApiError);
      spy.mockRestore();
    });
  });

  describe('updateTab', () => {
    it('updates and returns domain type', async () => {
      const created = await fakeBrowser.tabs.create({ url: 'https://old.com' });
      const updated = await updateTab(created.id!, { url: 'https://new.com' });
      expect(updated.url).toBe('https://new.com');
      expect(updated).not.toHaveProperty('index');
    });
  });

  describe('event subscriptions', () => {
    it('onTabCreated converts to domain type and returns cleanup', async () => {
      const received: ChromeTabData[] = [];
      const cleanup = onTabCreated((tab) => received.push(tab));

      await fakeBrowser.tabs.onCreated.trigger({
        id: 42,
        index: 0,
        windowId: 1,
        url: 'https://triggered.com',
        active: true,
        highlighted: false,
        incognito: false,
        pinned: false,
      } as Browser.tabs.Tab);

      expect(received).toHaveLength(1);
      expect(received[0].id).toBe(42);
      expect(received[0]).not.toHaveProperty('index');

      cleanup();

      await fakeBrowser.tabs.onCreated.trigger({
        id: 43,
        index: 0,
      } as Browser.tabs.Tab);
      expect(received).toHaveLength(1);
    });

    it('onTabRemoved passes through tabId and removeInfo', async () => {
      const received: Array<{ tabId: number; info: { windowId: number; isWindowClosing: boolean } }> = [];
      const cleanup = onTabRemoved((tabId, info) => received.push({ tabId, info }));

      await fakeBrowser.tabs.onRemoved.trigger(99, {
        windowId: 5,
        isWindowClosing: false,
      });

      expect(received).toHaveLength(1);
      expect(received[0].tabId).toBe(99);
      expect(received[0].info.windowId).toBe(5);

      cleanup();
    });

    it('onTabUpdated converts tab to domain type', async () => {
      const received: Array<{ tabId: number; tab: ChromeTabData }> = [];
      const cleanup = onTabUpdated((tabId, _changeInfo, tab) => {
        received.push({ tabId, tab });
      });

      await fakeBrowser.tabs.onUpdated.trigger(
        50,
        { status: 'complete' },
        { id: 50, index: 0, url: 'https://updated.com' } as Browser.tabs.Tab,
      );

      expect(received).toHaveLength(1);
      expect(received[0].tabId).toBe(50);
      expect(received[0].tab.url).toBe('https://updated.com');
      expect(received[0].tab).not.toHaveProperty('index');

      cleanup();
    });
  });
});
