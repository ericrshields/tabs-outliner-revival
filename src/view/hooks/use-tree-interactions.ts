/**
 * Hook managing hover menu state, action dispatch, scroll-clear,
 * activation mode preference, and TreeContextValue construction.
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import type { MutableRef } from 'preact/hooks';
import type { ViewToBackgroundMessage } from '@/types/messages';
import type { HoveringMenuActionId } from '@/types/node';
import type {
  HoveringMenuActions,
  TreeContextValue,
} from '@/types/tree-context';
import { executeAction } from '../tree-actions';

const SINGLE_CLICK_KEY = 'singleClickActivation';

export interface HoverState {
  idMVC: string;
  actions: HoveringMenuActions;
  rect: DOMRect;
}

export interface UseTreeInteractionsOptions {
  postMessage: (msg: ViewToBackgroundMessage) => void;
  treeContainerRef: MutableRef<HTMLDivElement | null>;
  selectedId: string | null;
}

export interface UseTreeInteractionsReturn {
  hoverState: HoverState | null;
  clearHover: () => void;
  handleAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
  ctxValue: TreeContextValue;
}

export function useTreeInteractions({
  postMessage,
  treeContainerRef,
  selectedId,
}: UseTreeInteractionsOptions): UseTreeInteractionsReturn {
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  const handleRowEnter = useCallback(
    (id: string, actions: HoveringMenuActions, rect: DOMRect) => {
      setHoverState({ idMVC: id, actions, rect });
    },
    [],
  );

  const clearHover = useCallback(() => {
    setHoverState(null);
  }, []);

  const handleAction = useCallback(
    (idMVC: string, actionId: HoveringMenuActionId) => {
      postMessage(executeAction(idMVC, actionId));
      setHoverState(null);
    },
    [postMessage],
  );

  // Clear hover menu on scroll (position becomes stale)
  useEffect(() => {
    const container = treeContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', clearHover, true);
    return () => container.removeEventListener('scroll', clearHover, true);
  }, [clearHover, treeContainerRef]);

  // Activation mode: double-click (default) or single-click (legacy)
  const singleClickActivation = useMemo(
    () => localStorage.getItem(SINGLE_CLICK_KEY) === 'true',
    [],
  );

  // Stable context value
  const ctxValue: TreeContextValue = useMemo(
    () => ({
      cursorId: selectedId ?? null,
      hoveredId: hoverState?.idMVC ?? null,
      singleClickActivation,
      onRowEnter: handleRowEnter,
      onAction: handleAction,
    }),
    [
      selectedId,
      hoverState?.idMVC,
      singleClickActivation,
      handleRowEnter,
      handleAction,
    ],
  );

  return { hoverState, clearHover, handleAction, ctxValue };
}
