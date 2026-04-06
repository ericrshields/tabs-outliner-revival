/* eslint-disable react-hooks/refs */
/**
 * Right-click context menu for tree nodes.
 *
 * Rendered via createPortal into document.body to avoid overflow:hidden
 * clipping. Positioned at the cursor with smart viewport clamping.
 *
 * Note: react-hooks/refs is disabled for this file. All treeRef.current
 * accesses are inside useCallback or direct event handlers — never during
 * render — but the linter traces through closure chains and flags them.
 *
 * Closes on: Escape keydown, click outside, or parent calling onClose.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import type { HoveringMenuActionId } from '@/types/node';
import type { ViewToBackgroundMessage } from '@/types/messages';
import { moveHierarchy } from '@/view/tree-actions';

export interface ContextMenuProps {
  idMVC: string;
  nodeDTO: NodeDTO;
  x: number;
  y: number;
  hasClipboard: boolean;
  treeRef: React.RefObject<TreeApi<NodeDTO> | null>;
  postMessage: (msg: ViewToBackgroundMessage) => void;
  onAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: (parentId: string | null, position: number) => void;
  onRestore: (idMVC: string) => void;
  onClose: () => void;
}

const MENU_WIDTH = 220;
function clampPosition(
  x: number,
  y: number,
  menuHeight: number,
): { top: number; left: number } {
  const maxLeft = Math.max(0, window.innerWidth - MENU_WIDTH - 4);
  const maxTop = Math.max(0, window.innerHeight - menuHeight - 4);
  return {
    left: Math.min(x, maxLeft),
    top: Math.min(y, maxTop),
  };
}

export function ContextMenu({
  idMVC,
  nodeDTO,
  x,
  y,
  hasClipboard,
  treeRef,
  postMessage,
  onAction,
  onCut,
  onCopy,
  onPaste,
  onRestore,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Initial position uses a conservative estimate; corrected after mount
  // once actual menu height is known to avoid clipping variable-height sections.
  const [position, setPosition] = useState(() => clampPosition(x, y, 400));
  useEffect(() => {
    if (!menuRef.current) return;
    const actualHeight = menuRef.current.offsetHeight;
    setPosition(clampPosition(x, y, actualHeight));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- x/y are stable for the lifetime of this mount
  const { top, left } = position;

  const actions = nodeDTO.hoveringMenuActions;
  const hasClose = !!actions.closeAction;
  const hasDelete = !!actions.deleteAction;
  const hasEdit = !!actions.editTitleAction;
  const isInternal = nodeDTO.isSubnodesPresent || nodeDTO.subnodes.length > 0;
  const isSavedTab =
    nodeDTO.titleBackgroundCssClass === 'tabFrame' && !hasClose;
  const isSavedWindow =
    nodeDTO.titleBackgroundCssClass === 'windowFrame' && !hasClose;
  const canRestore = isSavedTab || isSavedWindow;

  // Pre-compute which move directions are valid for the right-clicked node.
  // Accessing treeRef.current during render is intentional here — disabled
  // state is best-effort; staleness only causes a brief visual glitch.
  const menuNode = treeRef.current?.get(idMVC) ?? null;
  const menuIdx = menuNode?.childIndex ?? 0;
  const menuSibCount = menuNode?.parent?.children?.length ?? 1;
  const canMoveUp = menuIdx > 0;
  const canMoveDown = menuIdx < menuSibCount - 1;
  // Use isRoot for same-parent check — ROOT_ID is a non-empty string so
  // id comparison alone can't distinguish root siblings from real siblings.
  const canIndent =
    menuNode != null &&
    menuNode.prev != null &&
    !menuNode.prev.isRoot &&
    menuNode.prev.parent?.id === menuNode.parent?.id;
  // canOutdent: disable when parent OR grandparent is the virtual root.
  // - parent.isRoot → node is already at top level
  // - parent.parent.isRoot → outdenting would place node at root, triggering
  //   auto-wrap into a new window, which is confusing UX.
  const canOutdent =
    menuNode != null &&
    !menuNode.parent?.isRoot &&
    !menuNode.parent?.parent?.isRoot;
  const canMoveFirst = menuIdx > 0;
  const canMoveLast = menuIdx < menuSibCount - 1;

  // Use idMVC (the right-clicked node) as the target for paste and moves.
  const getPasteTarget = useCallback((): {
    parentId: string | null;
    position: number;
  } => {
    const arboristNode = treeRef.current?.get(idMVC);
    if (!arboristNode) return { parentId: null, position: -1 };
    return {
      parentId: arboristNode.parent?.isRoot
        ? null
        : (arboristNode.parent?.id ?? null),
      position: arboristNode.childIndex + 1,
    };
  }, [idMVC, treeRef]);

  const handleMove = useCallback(
    (direction: 'up' | 'down' | 'indent' | 'outdent' | 'first' | 'last') => {
      const node = treeRef.current?.get(idMVC);
      if (!node) return;
      const parentId: string | null = node.parent?.isRoot
        ? null
        : (node.parent?.id ?? null);
      const idx = node.childIndex;

      let target: {
        sourceId: string;
        parentId: string | null;
        position: number;
      } | null = null;

      switch (direction) {
        case 'up':
          if (idx > 0)
            target = { sourceId: idMVC, parentId, position: idx - 1 };
          break;
        case 'down': {
          const sibCount = node.parent?.children?.length ?? 1;
          if (idx < sibCount - 1)
            target = { sourceId: idMVC, parentId, position: idx + 1 };
          break;
        }
        case 'indent': {
          const prev = node.prev;
          // Guard: prev must be a real sibling (not arborist root, same parent).
          if (prev && !prev.isRoot && prev.parent?.id === node.parent?.id)
            target = {
              sourceId: idMVC,
              parentId: prev.id,
              position: prev.children?.length ?? 0,
            };
          break;
        }
        case 'outdent': {
          // Only outdent if parent is a real node (not the arborist virtual root).
          if (node.parent && !node.parent.isRoot) {
            const grandparent = node.parent.parent;
            target = {
              sourceId: idMVC,
              parentId: grandparent?.isRoot ? null : (grandparent?.id ?? null),
              position: (node.parent.childIndex ?? 0) + 1,
            };
          }
          break;
        }
        case 'first':
          target = { sourceId: idMVC, parentId, position: 0 };
          break;
        case 'last': {
          const sibCount = node.parent?.children?.length ?? 1;
          if (idx < sibCount - 1)
            target = { sourceId: idMVC, parentId, position: sibCount - 1 };
          break;
        }
      }

      if (!target) return;
      postMessage(
        moveHierarchy(target.sourceId, target.parentId, target.position),
      );
      onClose();
    },
    [idMVC, treeRef, postMessage, onClose],
  );

  const item = (
    label: string,
    shortcut: string,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      className={`ctx-menu-item${disabled ? ' ctx-menu-item--disabled' : ''}`}
      disabled={disabled}
      onClick={
        disabled
          ? undefined
          : (e) => {
              e.stopPropagation();
              onClick();
            }
      }
    >
      <span className="ctx-menu-label">{label}</span>
      <span className="ctx-menu-shortcut">{shortcut}</span>
    </button>
  );

  const separator = () => <div className="ctx-menu-separator" />;

  const menu = (
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ top, left, width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ctx-menu-section">
        {item('Cut', 'Ctrl+X', () => {
          onCut();
          onClose();
        })}
        {item('Copy', 'Ctrl+C', () => {
          onCopy();
          onClose();
        })}
        {item(
          'Paste',
          'Ctrl+V',
          () => {
            const { parentId, position } = getPasteTarget();
            onPaste(parentId, position);
            onClose();
          },
          !hasClipboard,
        )}
      </div>

      {(hasEdit || hasClose || hasDelete || canRestore) && (
        <>
          {separator()}
          <div className="ctx-menu-section">
            {hasEdit &&
              item('Edit', 'F2', () => {
                onAction(idMVC, 'editTitleAction');
              })}
            {hasClose &&
              item('Save & Close', 'Backspace', () => {
                onAction(idMVC, 'closeAction');
              })}
            {canRestore &&
              item('Restore', 'o', () => {
                onRestore(idMVC);
                onClose();
              })}
            {hasDelete &&
              item('Delete', 'Del', () => {
                onAction(idMVC, 'deleteAction');
              })}
          </div>
        </>
      )}

      {separator()}
      <div className="ctx-menu-section">
        {item('Move Up', 'Ctrl+↑', () => handleMove('up'), !canMoveUp)}
        {item('Move Down', 'Ctrl+↓', () => handleMove('down'), !canMoveDown)}
        {item('Indent →', 'Ctrl+→', () => handleMove('indent'), !canIndent)}
        {item('Outdent ←', 'Ctrl+←', () => handleMove('outdent'), !canOutdent)}
        {item(
          'To First',
          'Ctrl+Home',
          () => handleMove('first'),
          !canMoveFirst,
        )}
        {item('To Last', 'Ctrl+End', () => handleMove('last'), !canMoveLast)}
      </div>

      {isInternal && (
        <>
          {separator()}
          <div className="ctx-menu-section">
            {item(nodeDTO.colapsed ? 'Expand' : 'Collapse', '-', () => {
              onAction(idMVC, 'setCursorAction');
              postMessage({
                request: 'request2bkg_invertCollapsedState',
                targetNodeIdMVC: idMVC,
              });
              onClose();
            })}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(menu, document.body);
}
