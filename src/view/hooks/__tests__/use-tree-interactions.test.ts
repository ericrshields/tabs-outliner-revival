import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import type { MutableRef } from 'preact/hooks';
import type { HoveringMenuActionId } from '@/types/node';

vi.mock('../../tree-actions', () => ({
  executeAction: vi.fn((id: string, actionId: string) => ({
    request: 'request2bkg_execute_action',
    idMVC: id,
    actionId,
  })),
  applyNodeTabText: vi.fn((id: string, text: string) => ({
    request: 'request2bkg_onOkAfterSetNodeTabTextPrompt',
    targetNodeIdMVC: id,
    newText: text,
  })),
  applyNodeNoteText: vi.fn((id: string, text: string) => ({
    request: 'request2bkg_onOkAfterSetNodeNoteTextPrompt',
    targetNodeIdMVC: id,
    newText: text,
  })),
  applyNodeWindowText: vi.fn((id: string, text: string) => ({
    request: 'request2bkg_onOkAfterSetNodeWindowTextPrompt',
    targetNodeIdMVC: id,
    newText: text,
  })),
}));

import { useTreeInteractions } from '../use-tree-interactions';
import type { UseTreeInteractionsOptions } from '../use-tree-interactions';
import { executeAction } from '../../tree-actions';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function makeOptions(
  overrides: Partial<UseTreeInteractionsOptions> = {},
): UseTreeInteractionsOptions {
  return {
    postMessage: vi.fn(),
    treeContainerRef: { current: null } as MutableRef<HTMLDivElement | null>,
    selectedId: null,
    editingNode: null,
    clearEditing: vi.fn(),
    onOpenContextMenu: vi.fn(),
    hasClipboard: false,
    ...overrides,
  };
}

function makeMockActions() {
  return {
    actions: { close: { id: 'close' as HoveringMenuActionId } } as Record<
      string,
      { id: HoveringMenuActionId }
    >,
    idMVC: 'win1',
  };
}

describe('useTreeInteractions', () => {
  it('starts with null hoverState', () => {
    const { result } = renderHook(() => useTreeInteractions(makeOptions()));
    expect(result.current.hoverState).toBeNull();
  });

  it('sets hoverState on handleRowEnter via ctxValue', () => {
    const { result } = renderHook(() => useTreeInteractions(makeOptions()));
    const actions = makeMockActions();
    const rect = new DOMRect(0, 0, 100, 24);

    act(() => result.current.ctxValue.onRowEnter('win1', actions, rect));

    expect(result.current.hoverState).toEqual({
      idMVC: 'win1',
      actions,
      rect,
    });
  });

  it('clearHover resets hoverState to null', () => {
    const { result } = renderHook(() => useTreeInteractions(makeOptions()));
    const actions = makeMockActions();
    const rect = new DOMRect(0, 0, 100, 24);

    act(() => result.current.ctxValue.onRowEnter('win1', actions, rect));
    expect(result.current.hoverState).not.toBeNull();

    act(() => result.current.clearHover());
    expect(result.current.hoverState).toBeNull();
  });

  describe('handleAction', () => {
    it('posts executeAction message', () => {
      const postMessage = vi.fn();
      const { result } = renderHook(() =>
        useTreeInteractions(makeOptions({ postMessage })),
      );

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );

      expect(executeAction).toHaveBeenCalledWith('win1', 'close');
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ request: 'request2bkg_execute_action' }),
      );
    });

    it('clears hoverState after action', () => {
      const postMessage = vi.fn();
      const { result } = renderHook(() =>
        useTreeInteractions(makeOptions({ postMessage })),
      );
      const actions = makeMockActions();
      const rect = new DOMRect(0, 0, 100, 24);

      act(() => result.current.ctxValue.onRowEnter('win1', actions, rect));
      expect(result.current.hoverState).not.toBeNull();

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );
      expect(result.current.hoverState).toBeNull();
    });
  });

  describe('hover cooldown after action', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('suppresses onRowEnter fired immediately after handleAction', () => {
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      const actions = makeMockActions();
      const rect = new DOMRect(0, 0, 100, 24);

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );
      act(() => result.current.ctxValue.onRowEnter('win2', actions, rect));

      expect(result.current.hoverState).toBeNull();
    });

    it('suppresses onRowEnter for the same node after its own action (phantom-row scenario)', () => {
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      const actions = makeMockActions();
      const rect = new DOMRect(0, 0, 100, 24);

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );
      act(() => result.current.ctxValue.onRowEnter('win1', actions, rect));

      expect(result.current.hoverState).toBeNull();
    });

    it('accepts onRowEnter once the cooldown elapses', () => {
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      const actions = makeMockActions();
      const rect = new DOMRect(0, 0, 100, 24);

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => result.current.ctxValue.onRowEnter('win2', actions, rect));

      expect(result.current.hoverState).toEqual({
        idMVC: 'win2',
        actions,
        rect,
      });
    });

    it('restarts the cooldown on consecutive actions', () => {
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      const actions = makeMockActions();
      const rect = new DOMRect(0, 0, 100, 24);

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );
      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() =>
        result.current.handleAction('win2', 'close' as HoveringMenuActionId),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => result.current.ctxValue.onRowEnter('win3', actions, rect));
      expect(result.current.hoverState).toBeNull();

      act(() => {
        vi.advanceTimersByTime(60);
      });
      act(() => result.current.ctxValue.onRowEnter('win3', actions, rect));
      expect(result.current.hoverState).not.toBeNull();
    });

    it('clears the pending timer on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useTreeInteractions(makeOptions()),
      );

      act(() =>
        result.current.handleAction('win1', 'close' as HoveringMenuActionId),
      );
      expect(vi.getTimerCount()).toBe(1);

      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('scroll-clear effect', () => {
    it('attaches scroll listener to container ref', () => {
      const container = document.createElement('div');
      const addSpy = vi.spyOn(container, 'addEventListener');
      const ref = { current: container } as MutableRef<HTMLDivElement | null>;

      renderHook(() =>
        useTreeInteractions(makeOptions({ treeContainerRef: ref })),
      );

      expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    });

    it('removes listener on unmount', () => {
      const container = document.createElement('div');
      const removeSpy = vi.spyOn(container, 'removeEventListener');
      const ref = { current: container } as MutableRef<HTMLDivElement | null>;

      const { unmount } = renderHook(() =>
        useTreeInteractions(makeOptions({ treeContainerRef: ref })),
      );
      unmount();

      expect(removeSpy).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        true,
      );
    });
  });

  describe('singleClickActivation', () => {
    it('defaults to false when not set', () => {
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      expect(result.current.ctxValue.singleClickActivation).toBe(false);
    });

    it('reads true from localStorage', () => {
      localStorage.setItem('singleClickActivation', 'true');
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      expect(result.current.ctxValue.singleClickActivation).toBe(true);
    });
  });

  describe('ctxValue', () => {
    it('includes cursorId from selectedId', () => {
      const { result } = renderHook(() =>
        useTreeInteractions(makeOptions({ selectedId: 'tab1' })),
      );
      expect(result.current.ctxValue.cursorId).toBe('tab1');
    });

    it('includes hoveredId from hoverState', () => {
      const { result } = renderHook(() => useTreeInteractions(makeOptions()));
      const actions = makeMockActions();
      const rect = new DOMRect(0, 0, 100, 24);

      act(() => result.current.ctxValue.onRowEnter('win1', actions, rect));

      expect(result.current.ctxValue.hoveredId).toBe('win1');
    });

    it('maintains stable reference when dependencies unchanged', () => {
      const postMessage = vi.fn();
      const ref = { current: null } as MutableRef<HTMLDivElement | null>;
      const opts: UseTreeInteractionsOptions = {
        postMessage,
        treeContainerRef: ref,
        selectedId: 'tab1',
        editingNode: null,
        clearEditing: vi.fn(),
        onOpenContextMenu: vi.fn(),
        hasClipboard: false,
      };
      const { result, rerender } = renderHook(
        (props: UseTreeInteractionsOptions) => useTreeInteractions(props),
        { initialProps: opts },
      );
      const firstCtxValue = result.current.ctxValue;

      rerender({ ...opts });

      expect(result.current.ctxValue).toBe(firstCtxValue);
    });
  });
});
