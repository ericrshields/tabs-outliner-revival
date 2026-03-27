/**
 * Hook managing hover menu state, action dispatch, scroll-clear,
 * activation mode preference, inline edit, and TreeContextValue construction.
 */

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import type { MutableRef } from 'preact/hooks';
import type { ViewToBackgroundMessage } from '@/types/messages';
import type { HoveringMenuActionId } from '@/types/node';
import type { NodeDTO } from '@/types/node-dto';
import type {
  HoveringMenuActions,
  TreeContextValue,
  EditKind,
} from '@/types/tree-context';
import type { EditingNodeState } from './use-tree-data';
import {
  executeAction,
  applyNodeTabText,
  applyNodeNoteText,
  applyNodeWindowText,
} from '../tree-actions';

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
  editingNode: EditingNodeState | null;
  clearEditing: () => void;
  onOpenContextMenu: (
    idMVC: string,
    nodeDTO: NodeDTO,
    x: number,
    y: number,
  ) => void;
  hasClipboard: boolean;
}

export interface UseTreeInteractionsReturn {
  hoverState: HoverState | null;
  clearHover: () => void;
  handleAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
  ctxValue: TreeContextValue;
  /** The last node the user deliberately interacted with (click, action, context menu). Used as the keyboard shortcut target so shortcuts operate on the intended node regardless of where the mouse currently is. */
  lastKeyboardTargetId: { current: string | null };
  /** Local cursor ID for visual selection — updated on click and synced from backend setCursorHere messages. */
  localCursorId: string | null;
}

export function useTreeInteractions({
  postMessage,
  treeContainerRef,
  selectedId,
  editingNode,
  clearEditing,
  onOpenContextMenu,
  hasClipboard,
}: UseTreeInteractionsOptions): UseTreeInteractionsReturn {
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  // Tracks the last deliberately interacted-with node. Used as the keyboard
  // shortcut target so keys operate on the intended node, not wherever the
  // mouse currently happens to be.
  const lastKeyboardTargetId = useRef<string | null>(null);

  // Visual cursor: updated by local clicks AND synced from backend setCursorHere.
  // Drives both the cursor-node highlight class and react-arborist selection prop.
  const [localCursorId, setLocalCursorId] = useState<string | null>(selectedId);
  // Track the last selectedId we synced from so we detect changes during render.
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(
    selectedId,
  );

  // Sync localCursorId when the backend sends a new setCursorHere (selectedId changes).
  // Using the "update during render" pattern (React docs) instead of useEffect to
  // avoid cascading renders for the state update.
  if (selectedId !== prevSelectedId && selectedId !== null) {
    setPrevSelectedId(selectedId);
    setLocalCursorId(selectedId);
  }

  // Sync the keyboard-shortcut ref to the backend cursor via effect (ref writes
  // are side effects — this is the correct pattern, unlike setState-in-effect).
  useEffect(() => {
    if (selectedId !== null) {
      lastKeyboardTargetId.current = selectedId;
    }
  }, [selectedId]);

  const handleRowEnter = useCallback(
    (id: string, actions: HoveringMenuActions, rect: DOMRect) => {
      setHoverState({ idMVC: id, actions, rect });
      // Note: lastKeyboardTargetId is NOT updated here — keyboard shortcuts
      // require an explicit click/action/context-menu to set the target.
    },
    [],
  );

  const clearHover = useCallback(() => {
    setHoverState(null);
  }, []);

  const handleNodeClick = useCallback((idMVC: string) => {
    lastKeyboardTargetId.current = idMVC;
    setLocalCursorId(idMVC);
  }, []);

  const handleAction = useCallback(
    (idMVC: string, actionId: HoveringMenuActionId) => {
      lastKeyboardTargetId.current = idMVC;
      postMessage(executeAction(idMVC, actionId));
      setHoverState(null);
    },
    [postMessage],
  );

  const handleEditComplete = useCallback(
    (idMVC: string, newText: string, kind: EditKind) => {
      switch (kind) {
        case 'tab':
          postMessage(applyNodeTabText(idMVC, newText));
          break;
        case 'note':
          postMessage(applyNodeNoteText(idMVC, newText));
          break;
        case 'window':
          postMessage(applyNodeWindowText(idMVC, newText));
          break;
      }
      clearEditing();
    },
    [postMessage, clearEditing],
  );

  const handleEditCancel = useCallback(() => {
    clearEditing();
  }, [clearEditing]);

  const handleContextMenu = useCallback(
    (idMVC: string, nodeDTO: NodeDTO, x: number, y: number) => {
      lastKeyboardTargetId.current = idMVC;
      onOpenContextMenu(idMVC, nodeDTO, x, y);
    },
    [onOpenContextMenu],
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
      cursorId: localCursorId ?? null,
      hoveredId: hoverState?.idMVC ?? null,
      singleClickActivation,
      onRowEnter: handleRowEnter,
      onAction: handleAction,
      editingId: editingNode?.idMVC ?? null,
      editDefaultText: editingNode?.defaultText ?? '',
      onEditComplete: handleEditComplete,
      onEditCancel: handleEditCancel,
      onContextMenu: handleContextMenu,
      onNodeClick: handleNodeClick,
      hasClipboard,
    }),
    [
      localCursorId,
      hoverState?.idMVC,
      singleClickActivation,
      handleRowEnter,
      handleAction,
      editingNode?.idMVC,
      editingNode?.defaultText,
      handleEditComplete,
      handleEditCancel,
      handleContextMenu,
      handleNodeClick,
      hasClipboard,
    ],
  );

  return {
    hoverState,
    clearHover,
    handleAction,
    ctxValue,
    lastKeyboardTargetId,
    localCursorId,
  };
}
