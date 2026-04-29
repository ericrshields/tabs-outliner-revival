/**
 * Hook managing hover menu state, action dispatch, scroll-clear,
 * activation mode preference, inline edit, and TreeContextValue construction.
 */

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
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

// After an action collapses/removes a row, the next sibling slides into the same
// pixel position under the user's stationary cursor and fires onMouseEnter on the
// re-render. Suppress row-enter callbacks briefly so the menu doesn't reappear
// on the wrong node.
const HOVER_COOLDOWN_MS = 150;

// Each scroll event resets a short timer; while it's pending we treat the tree
// as actively scrolling. Prevents the hovering menu from flicker-tracking rows
// that slide under a stationary pointer during wheel scrolls. Two frames at
// 60fps — long enough that consecutive wheel ticks reliably reset the timer
// before it fires (~16ms wheel cadence on most hardware), short enough that
// hover/click responsiveness post-scroll stays well under the 150ms debounce
// react-window itself used (which is what made the bug visible).
const SCROLL_QUIESCE_MS = 32;

export interface HoverState {
  idMVC: string;
  actions: HoveringMenuActions;
  rect: DOMRect;
}

export interface UseTreeInteractionsOptions {
  postMessage: (msg: ViewToBackgroundMessage) => void;
  /**
   * The tree container element, populated via a callback ref. May be null
   * on the first render (the tree div is gated by isLoading) and become
   * populated later — effects depending on it re-run when it changes.
   */
  treeContainer: HTMLDivElement | null;
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
  treeContainer,
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

  const actionCooldownRef = useRef(false);
  const actionCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // useState drives reactive UI (HoveringMenu disables its buttons via
  // ctx.isScrolling). Ref mirrors the state for synchronous reads inside
  // event handlers — needed because state updates are batched.
  const [isScrolling, setIsScrolling] = useState(false);
  const isScrollingRef = useRef(false);
  const scrollQuiesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Tracks the most recent row mouseenter fired for, so we can reapply hover
  // when scroll quiesces over a row whose mouseenter doesn't refire on its
  // own (browser only emits mouseenter when the cursor crosses an element
  // boundary — sitting still while a row scrolls into place doesn't qualify).
  const lastEnteredRowRef = useRef<{
    idMVC: string;
    actions: HoveringMenuActions;
  } | null>(null);

  const handleRowEnter = useCallback(
    (id: string, actions: HoveringMenuActions, rect: DOMRect) => {
      if (actionCooldownRef.current) return;
      // Hover is intentionally NOT gated by isScrollingRef — letting the
      // menu pop in for each row that slides under a stationary pointer
      // gives useful visual feedback during scroll. The action buttons
      // themselves are disabled via ctx.isScrolling so a misaimed click
      // can't fire against the wrong row.
      lastEnteredRowRef.current = { idMVC: id, actions };
      setHoverState({ idMVC: id, actions, rect });
      // Note: lastKeyboardTargetId is NOT updated here — keyboard shortcuts
      // require an explicit click/action/context-menu to set the target.
    },
    [],
  );

  const clearHover = useCallback(() => {
    lastEnteredRowRef.current = null;
    setHoverState(null);
  }, []);

  const handleNodeClick = useCallback((idMVC: string) => {
    lastKeyboardTargetId.current = idMVC;
    setLocalCursorId(idMVC);
  }, []);

  const handleAction = useCallback(
    (idMVC: string, actionId: HoveringMenuActionId) => {
      // Belt-and-suspenders against the scroll-misaim corner case: even if
      // a button somehow fires its onClick while the tree is scrolling
      // (e.g. disabled state hasn't propagated yet), drop the action.
      if (isScrollingRef.current) return;
      lastKeyboardTargetId.current = idMVC;
      postMessage(executeAction(idMVC, actionId));
      setHoverState(null);
      actionCooldownRef.current = true;
      if (actionCooldownTimerRef.current !== null) {
        clearTimeout(actionCooldownTimerRef.current);
      }
      actionCooldownTimerRef.current = setTimeout(() => {
        actionCooldownRef.current = false;
        actionCooldownTimerRef.current = null;
      }, HOVER_COOLDOWN_MS);
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

  // On scroll: clear the (now stale) hover menu and mark the tree as
  // actively scrolling so HoveringMenu can disable its action buttons
  // until the scroll quiesces. On quiesce, restore hover for the row that
  // mouseenter last fired for (looked up via data-mvc-id for a fresh rect)
  // so the user doesn't have to wiggle the mouse to bring the menu back
  // when scrolling stops with the cursor over an already-traversed row.
  useEffect(() => {
    if (!treeContainer) return;
    const onScroll = (): void => {
      isScrollingRef.current = true;
      setIsScrolling(true);
      setHoverState(null);
      if (scrollQuiesceTimerRef.current !== null) {
        clearTimeout(scrollQuiesceTimerRef.current);
      }
      scrollQuiesceTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;
        setIsScrolling(false);
        scrollQuiesceTimerRef.current = null;
        const last = lastEnteredRowRef.current;
        if (!last) return;
        const el = treeContainer.querySelector<HTMLElement>(
          `[data-mvc-id="${CSS.escape(last.idMVC)}"]`,
        );
        if (!el) return;
        setHoverState({
          idMVC: last.idMVC,
          actions: last.actions,
          rect: el.getBoundingClientRect(),
        });
      }, SCROLL_QUIESCE_MS);
    };
    treeContainer.addEventListener('scroll', onScroll, true);
    return () => treeContainer.removeEventListener('scroll', onScroll, true);
  }, [treeContainer]);

  useEffect(() => {
    return () => {
      if (actionCooldownTimerRef.current !== null) {
        clearTimeout(actionCooldownTimerRef.current);
        actionCooldownTimerRef.current = null;
      }
      actionCooldownRef.current = false;
      if (scrollQuiesceTimerRef.current !== null) {
        clearTimeout(scrollQuiesceTimerRef.current);
        scrollQuiesceTimerRef.current = null;
      }
      isScrollingRef.current = false;
    };
  }, []);

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
      isScrolling,
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
      isScrolling,
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
