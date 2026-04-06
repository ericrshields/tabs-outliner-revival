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
  it('starts with hasClipboard = false', () => {
    const { result } = renderHook(() => useClipboard(makeOptions()));
    expect(result.current.hasClipboard).toBe(false);
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
    it('posts moveHierarchy and keeps clipboard for retry', () => {
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
      // Clipboard stays active so the user can retry if the move fails.
      expect(result.current.hasClipboard).toBe(true);
    });

    it('allows paste again after cut (node moves from new location)', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useClipboard(opts));

      act(() => result.current.cut('node1', 'x'));
      act(() => result.current.paste('p', 0));
      act(() => result.current.paste('q', 1));

      expect(opts.postMessage).toHaveBeenCalledTimes(2);
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
