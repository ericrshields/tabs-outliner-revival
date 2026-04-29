/**
 * Tests for the in-memory clipboard hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useClipboard } from '../use-clipboard';
import type { ViewToBackgroundMessage } from '@/types/messages';

// Stub navigator.clipboard.writeText
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

function makeOptions() {
  const postMessage = vi.fn() as (msg: ViewToBackgroundMessage) => void;
  return { postMessage };
}

describe('useClipboard', () => {
  it('starts with hasClipboard = false and entry = null', () => {
    const { result } = renderHook(() => useClipboard(makeOptions()));
    expect(result.current.hasClipboard).toBe(false);
    expect(result.current.entry).toBeNull();
  });

  describe('entry exposure for visual indicators', () => {
    it('cut sets entry with kind="cut" and the source id', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.cut('node1', 'Tab Title'));
      expect(result.current.entry).toEqual({
        sourceIdMVC: 'node1',
        kind: 'cut',
      });
    });

    it('copy sets entry with kind="copy" and the source id', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.copy('node2', 'Window'));
      expect(result.current.entry).toEqual({
        sourceIdMVC: 'node2',
        kind: 'copy',
      });
    });

    it('clearClipboard nulls the entry', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.cut('node1', 'x'));
      expect(result.current.entry).not.toBeNull();
      act(() => result.current.clearClipboard());
      expect(result.current.entry).toBeNull();
    });

    it('paste does NOT change entry — visual indicator persists for retry/multi-paste', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.copy('node3', 'x'));
      const before = result.current.entry;
      act(() => result.current.paste('p', 0));
      expect(result.current.entry).toBe(before);
    });
  });

  describe('cut()', () => {
    it('sets hasClipboard to true', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.cut('node1', 'Tab Title'));
      expect(result.current.hasClipboard).toBe(true);
    });

    it('writes to navigator.clipboard', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.cut('node1', 'Tab Title'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Tab Title');
    });
  });

  describe('copy()', () => {
    it('sets hasClipboard to true', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.copy('node2', 'Window Title'));
      expect(result.current.hasClipboard).toBe(true);
    });

    it('writes to navigator.clipboard', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.copy('node2', 'Window Title'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Window Title',
      );
    });
  });

  describe('paste() after cut', () => {
    it('posts moveHierarchy on the first paste', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.cut('node1', 'Tab Title'));
      act(() => result.current.paste('parent1', 2));

      expect(opts.postMessage).toHaveBeenCalledWith({
        request: 'request2bkg_moveHierarchy',
        targetNodeIdMVC: 'node1',
        containerIdMVC: 'parent1',
        position: 2,
      });
    });

    it('transitions the entry from cut to copy after the move fires', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.cut('node1', 'Tab Title'));
      expect(result.current.entry?.kind).toBe('cut');

      act(() => result.current.paste('parent1', 2));

      // The clipboard now reads as "copy" so the visual indicator
      // (dashed outline → solid blue tint) matches the new behavior:
      // future pastes clone from the moved location.
      expect(result.current.entry).toEqual({
        sourceIdMVC: 'node1',
        kind: 'copy',
      });
      expect(result.current.hasClipboard).toBe(true);
    });

    it('a second paste after cut posts copyHierarchy (not moveHierarchy)', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.cut('node1', 'x'));
      act(() => result.current.paste('p', 0));
      act(() => result.current.paste('q', 1));

      expect(opts.postMessage).toHaveBeenCalledTimes(2);
      expect(opts.postMessage).toHaveBeenNthCalledWith(1, {
        request: 'request2bkg_moveHierarchy',
        targetNodeIdMVC: 'node1',
        containerIdMVC: 'p',
        position: 0,
      });
      expect(opts.postMessage).toHaveBeenNthCalledWith(2, {
        request: 'request2bkg_copyHierarchy',
        sourceIdMVC: 'node1',
        targetParentIdMVC: 'q',
        targetPosition: 1,
      });
    });
  });

  describe('paste() after copy', () => {
    it('posts copyHierarchy and keeps clipboard', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.copy('node2', 'Window Title'));
      act(() => result.current.paste('parent2', 0));

      expect(opts.postMessage).toHaveBeenCalledWith({
        request: 'request2bkg_copyHierarchy',
        sourceIdMVC: 'node2',
        targetParentIdMVC: 'parent2',
        targetPosition: 0,
      });
      expect(result.current.hasClipboard).toBe(true);
    });

    it('allows paste multiple times after copy', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.copy('node2', 'x'));
      act(() => result.current.paste('p', 0));
      act(() => result.current.paste('p', 1));

      expect(opts.postMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearClipboard()', () => {
    it('sets hasClipboard to false', () => {
      const { result } = renderHook(() => useClipboard(makeOptions()));
      act(() => result.current.copy('node1', 'x'));
      act(() => result.current.clearClipboard());
      expect(result.current.hasClipboard).toBe(false);
    });

    it('prevents paste after clear', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.copy('node1', 'x'));
      act(() => result.current.clearClipboard());
      act(() => result.current.paste('p', 0));

      expect(opts.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('paste() with null parentId (root-level)', () => {
    it('passes null containerIdMVC for cut', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.cut('node1', 'x'));
      act(() => result.current.paste(null, 0));

      expect(opts.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ containerIdMVC: null }),
      );
    });
  });
});
