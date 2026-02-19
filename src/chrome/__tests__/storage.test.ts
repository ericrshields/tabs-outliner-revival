import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storageGet, storageSet, storageRemove, onStorageChanged } from '../storage';
import { ChromeApiError } from '../errors';

describe('storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('storageGet', () => {
    it('returns the stored value', async () => {
      await fakeBrowser.storage.local.set({ myKey: 'hello' });
      const result = await storageGet('local', 'myKey', 'default');
      expect(result).toBe('hello');
    });

    it('returns the fallback when key is absent', async () => {
      const result = await storageGet('local', 'missing', 42);
      expect(result).toBe(42);
    });

    it('works with sync storage area', async () => {
      await fakeBrowser.storage.sync.set({ syncKey: true });
      const result = await storageGet('sync', 'syncKey', false);
      expect(result).toBe(true);
    });

    it('works with session storage area', async () => {
      await fakeBrowser.storage.session.set({ sessKey: 'val' });
      const result = await storageGet('session', 'sessKey', 'nope');
      expect(result).toBe('val');
    });
  });

  describe('storageSet', () => {
    it('persists values that can be read back', async () => {
      await storageSet('local', { a: 1, b: 'two' });
      const result = await fakeBrowser.storage.local.get(['a', 'b']);
      expect(result).toEqual({ a: 1, b: 'two' });
    });
  });

  describe('storageRemove', () => {
    it('removes a single key', async () => {
      await fakeBrowser.storage.local.set({ x: 10, y: 20 });
      await storageRemove('local', 'x');
      const result = await fakeBrowser.storage.local.get(['x', 'y']);
      expect(result).toEqual({ y: 20 });
    });

    it('removes multiple keys', async () => {
      await fakeBrowser.storage.local.set({ a: 1, b: 2, c: 3 });
      await storageRemove('local', ['a', 'c']);
      const result = await fakeBrowser.storage.local.get(['a', 'b', 'c']);
      expect(result).toEqual({ b: 2 });
    });
  });

  describe('onStorageChanged', () => {
    it('fires the callback when the watched key changes', async () => {
      const changes: Array<{ newValue: unknown; oldValue: unknown }> = [];
      const cleanup = onStorageChanged('local', 'watchMe', (newVal, oldVal) => {
        changes.push({ newValue: newVal, oldValue: oldVal });
      });

      await storageSet('local', { watchMe: 'first' });
      await new Promise((r) => setTimeout(r, 0));

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue).toBe('first');
      // fakeBrowser reports null (not undefined) for the previous value on first write
      expect(changes[0].oldValue).toBeNull();

      cleanup();
    });

    it('returns a cleanup function that stops the listener', async () => {
      const calls: unknown[] = [];
      const cleanup = onStorageChanged('local', 'key1', (newVal) => {
        calls.push(newVal);
      });

      cleanup();

      await storageSet('local', { key1: 'after-cleanup' });
      await new Promise((r) => setTimeout(r, 0));
      expect(calls).toHaveLength(0);
    });

    it('ignores changes to other keys', async () => {
      const calls: unknown[] = [];
      const cleanup = onStorageChanged('local', 'target', (newVal) => {
        calls.push(newVal);
      });

      await storageSet('local', { otherKey: 'value' });
      await new Promise((r) => setTimeout(r, 0));
      expect(calls).toHaveLength(0);

      cleanup();
    });
  });
});
