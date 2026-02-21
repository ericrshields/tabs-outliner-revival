import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  toChromeWindowData,
  queryWindows,
  getWindow,
  createWindow,
  removeWindow,
  updateWindow,
  onWindowCreated,
  onWindowRemoved,
} from '../windows';
import { ChromeApiError } from '../errors';
import type { ChromeWindowData } from '@/types/chrome';

describe('windows', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('toChromeWindowData', () => {
    it('extracts persisted fields including rect', () => {
      const chromeWin = {
        id: 1,
        type: 'normal',
        incognito: false,
        alwaysOnTop: false,
        focused: true,
        top: 100,
        left: 200,
        width: 800,
        height: 600,
        state: 'normal',
      } as Browser.windows.Window;

      const result = toChromeWindowData(chromeWin);

      expect(result).toEqual({
        id: 1,
        type: 'normal',
        incognito: false,
        alwaysOnTop: false,
        focused: true,
        rect: { top: 100, left: 200, width: 800, height: 600 },
      });

      expect(result).not.toHaveProperty('state');
      expect(result).not.toHaveProperty('top');
    });

    it('sets rect to undefined when position fields are missing', () => {
      const chromeWin = { id: 2, focused: false } as Browser.windows.Window;
      const result = toChromeWindowData(chromeWin);
      expect(result.rect).toBeUndefined();
    });

    it('sets rect to undefined when some position fields are missing', () => {
      const chromeWin = { id: 3, top: 0, left: 0 } as Browser.windows.Window;
      const result = toChromeWindowData(chromeWin);
      expect(result.rect).toBeUndefined();
    });
  });

  describe('queryWindows', () => {
    it('returns domain-typed windows', async () => {
      await fakeBrowser.windows.create({ type: 'normal' });
      const wins = await queryWindows();
      expect(wins.length).toBeGreaterThan(0);
      for (const win of wins) {
        expect(win).not.toHaveProperty('state');
        expect(win.id).toBeDefined();
      }
    });
  });

  describe('getWindow', () => {
    it('returns the window when it exists', async () => {
      const created = await fakeBrowser.windows.create({ type: 'normal' });
      const win = await getWindow(created.id!);
      expect(win).not.toBeNull();
      expect(win!.id).toBe(created.id);
    });

    it('returns null for nonexistent window', async () => {
      const win = await getWindow(999999);
      expect(win).toBeNull();
    });
  });

  describe('createWindow', () => {
    it('creates a window and returns domain type', async () => {
      const win = await createWindow({ type: 'normal' });
      expect(win.id).toBeDefined();
      expect(win).not.toHaveProperty('state');
    });
  });

  describe('removeWindow', () => {
    it('removes an existing window', async () => {
      const created = await fakeBrowser.windows.create({ type: 'normal' });
      await removeWindow(created.id!);
      const win = await getWindow(created.id!);
      expect(win).toBeNull();
    });
  });

  describe('updateWindow', () => {
    it('updates and returns domain type', async () => {
      const created = await fakeBrowser.windows.create({ type: 'normal' });
      const updated = await updateWindow(created.id!, { focused: true });
      expect(updated.id).toBe(created.id);
      expect(updated).not.toHaveProperty('state');
    });
  });

  describe('event subscriptions', () => {
    it('onWindowCreated converts to domain type and returns cleanup', async () => {
      const received: ChromeWindowData[] = [];
      const cleanup = onWindowCreated((win) => received.push(win));

      await fakeBrowser.windows.onCreated.trigger({
        id: 10,
        type: 'normal',
        focused: true,
        incognito: false,
        alwaysOnTop: false,
      } as Browser.windows.Window);

      expect(received).toHaveLength(1);
      expect(received[0].id).toBe(10);

      cleanup();

      await fakeBrowser.windows.onCreated.trigger({
        id: 11,
      } as Browser.windows.Window);
      expect(received).toHaveLength(1);
    });

    it('onWindowRemoved passes through windowId', async () => {
      const ids: number[] = [];
      const cleanup = onWindowRemoved((id) => ids.push(id));

      await fakeBrowser.windows.onRemoved.trigger(7);
      expect(ids).toEqual([7]);

      cleanup();
    });
  });
});
