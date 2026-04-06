/**
 * Keyboard shortcut handler for the tree view.
 *
 * Attaches a `keydown` listener to `document` (not the tree container —
 * react-arborist focus is unreliable). All shortcuts are suppressed when:
 *  - An INPUT or TEXTAREA has focus (e.g., inline edit is active)
 *  - editingId is set in tree state
 *
 * Shortcuts use the cursor node (selectedId) as the target. If no node
 * is selected, only Escape (close context menu) is handled.
 */

import { useEffect } from 'react';
import type { TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import type { ViewToBackgroundMessage } from '@/types/messages';
import type { UseClipboardReturn } from './use-clipboard';
import {
  executeAction,
  activateNode,
  toggleCollapse,
  moveHierarchy,
} from '../tree-actions';

export interface UseKeyboardShortcutsOptions {
  treeRef: React.RefObject<TreeApi<NodeDTO> | null>;
  postMessage: (msg: ViewToBackgroundMessage) => void;
  selectedId: string | null;
  /** Ref to the last deliberately interacted-with node. Stable target independent of mouse position. */
  lastKeyboardTargetId: { current: string | null };
  editingId: string | null;
  clipboard: UseClipboardReturn;
  closeContextMenu: () => void;
  contextMenuOpen: boolean;
}

export function useKeyboardShortcuts({
  treeRef,
  postMessage,
  selectedId,
  lastKeyboardTargetId,
  editingId,
  clipboard,
  closeContextMenu,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    // Throttle move operations: react-arborist's node tree (prev/parent/children)
    // is stale immediately after a move until the view re-renders with the new
    // data. Rapid successive moves compute positions against stale state and
    // target wrong nodes. 120ms covers a typical background round-trip.
    let moveCooldownUntil = 0;

    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (editingId) return;

      // Escape always closes context menu regardless of selection.
      if (e.key === 'Escape') {
        closeContextMenu();
        return;
      }

      // Use selectedId (backend cursor) first, then lastKeyboardTargetId (last
      // click/action/context menu). Never use hoveredId — mouse position changes
      // constantly and causes shortcuts to target the wrong node.
      const targetId = selectedId ?? lastKeyboardTargetId.current;
      if (!targetId) return;
      const arboristNode = treeRef.current?.get(targetId);
      if (!arboristNode) return;

      const idMVC = targetId;
      // react-arborist's virtual root has id "__REACT_ARBORIST_INTERNAL_ROOT__"
      // (non-null string), so `?.id ?? null` doesn't produce null for top-level
      // nodes. Use isRoot to map to null for the background handler.
      const parentId: string | null = arboristNode.parent?.isRoot
        ? null
        : (arboristNode.parent?.id ?? null);
      const idx = arboristNode.childIndex;

      let handled = true;
      const isMoveKey =
        e.ctrlKey &&
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Home',
          'End',
        ].includes(e.key);
      if (isMoveKey && Date.now() < moveCooldownUntil) {
        e.preventDefault();
        return;
      }

      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case 'x':
            clipboard.cut(idMVC, arboristNode.data.nodeText ?? '');
            break;
          case 'c':
            clipboard.copy(idMVC, arboristNode.data.nodeText ?? '');
            break;
          case 'v':
            clipboard.paste(parentId, idx + 1);
            break;
          case 'ArrowUp':
            if (idx > 0) {
              postMessage(moveHierarchy(idMVC, parentId, idx - 1));
              moveCooldownUntil = Date.now() + 120;
            }
            break;
          case 'ArrowDown':
            postMessage(moveHierarchy(idMVC, parentId, idx + 1));
            moveCooldownUntil = Date.now() + 120;
            break;
          case 'ArrowLeft': {
            // Disable when parent or grandparent is virtual root — outdenting
            // to root triggers auto-wrap which is confusing UX.
            const parentOk = arboristNode.parent && !arboristNode.parent.isRoot;
            const grandparentOk =
              arboristNode.parent?.parent && !arboristNode.parent.parent.isRoot;
            if (parentOk && grandparentOk && arboristNode.parent) {
              const grandparent = arboristNode.parent.parent;
              const parentIdx = arboristNode.parent.childIndex ?? 0;
              postMessage(
                moveHierarchy(
                  idMVC,
                  grandparent?.isRoot ? null : (grandparent?.id ?? null),
                  parentIdx + 1,
                ),
              );
              moveCooldownUntil = Date.now() + 120;
            }
            break;
          }
          case 'ArrowRight': {
            // Indent: make last direct child of the previous sibling.
            // Use isRoot to check same-level (ROOT_ID string would match falsely).
            const prev = arboristNode.prev;
            const sameParent =
              prev?.parent?.isRoot === arboristNode.parent?.isRoot &&
              prev?.parent?.id === arboristNode.parent?.id;
            if (prev && !prev.isRoot && sameParent) {
              postMessage(
                moveHierarchy(idMVC, prev.id, prev.children?.length ?? 0),
              );
              moveCooldownUntil = Date.now() + 120;
            }
            break;
          }
          case 'Home':
            postMessage(moveHierarchy(idMVC, parentId, 0));
            moveCooldownUntil = Date.now() + 120;
            break;
          case 'End': {
            const siblingCount = arboristNode.parent?.children?.length ?? 1;
            postMessage(moveHierarchy(idMVC, parentId, siblingCount - 1));
            moveCooldownUntil = Date.now() + 120;
            break;
          }
          default:
            handled = false;
        }
      } else if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case 'Delete':
            postMessage(executeAction(idMVC, 'deleteAction'));
            break;
          case 'Backspace':
            postMessage(executeAction(idMVC, 'closeAction'));
            break;
          case 'F2':
            postMessage(executeAction(idMVC, 'editTitleAction'));
            break;
          case 'o':
            postMessage(activateNode(idMVC));
            break;
          case '-':
            postMessage(toggleCollapse(idMVC));
            break;
          default:
            handled = false;
        }
      } else {
        handled = false;
      }

      if (handled) {
        e.preventDefault();
        // stopPropagation in capture phase prevents react-arborist's internal
        // keyboard handler from also receiving this event (which would cause
        // unwanted auto-scrolling to top/bottom of the tree on Home/End moves).
        e.stopPropagation();
      }
    };

    // Capture phase ensures e.preventDefault() runs before browser default
    // behaviours like Ctrl+End scrolling to bottom of page.
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [
    selectedId,
    lastKeyboardTargetId,
    editingId,
    treeRef,
    postMessage,
    clipboard,
    closeContextMenu,
  ]);
}
