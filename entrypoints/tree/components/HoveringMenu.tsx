import { useContext } from 'react';
import type { HoveringMenuActionId } from '@/types/node';
import type { NodeDTO } from '@/types/node-dto';
import { TreeContext } from './TreeContext';

export interface HoveringMenuProps {
  idMVC: string;
  actions: NodeDTO['hoveringMenuActions'];
  anchorRect: DOMRect;
  onAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
}

export function HoveringMenu({
  idMVC,
  actions,
  anchorRect,
  onAction,
}: HoveringMenuProps) {
  const { isScrolling } = useContext(TreeContext);
  const hasNote = !!actions.addNoteAction;
  const hasClose = !!actions.closeAction;
  const hasDelete = !!actions.deleteAction;

  if (!hasNote && !hasClose && !hasDelete) return null;

  // Anchor the right edge of the menu to the row's right edge so buttons
  // stay in a consistent position regardless of how many are rendered.
  // position:fixed uses viewport coordinates; DOMRect.right is also viewport.
  const style: Record<string, string | number> = {
    top: `${anchorRect.top}px`,
    right: `${window.innerWidth - anchorRect.right}px`,
  };

  // Disable while the tree is scrolling: the menu's idMVC was captured at
  // mouseenter time, but rows slide under a stationary pointer during a
  // scroll. A click would target whichever row mouseenter fired for last,
  // which may not be the row the user thinks they're aiming at.
  return (
    <div className="hovering-menu" style={style}>
      {hasNote && (
        <button
          className="hovering-menu-btn"
          title="Note"
          disabled={isScrolling}
          onClick={(e) => {
            e.stopPropagation();
            onAction(idMVC, 'addNoteAction');
          }}
        >
          ✎
        </button>
      )}
      {hasClose && (
        <button
          className="hovering-menu-btn"
          title="Close"
          disabled={isScrolling}
          onClick={(e) => {
            e.stopPropagation();
            onAction(idMVC, 'closeAction');
          }}
        >
          ✕
        </button>
      )}
      {hasDelete && (
        <button
          className="hovering-menu-btn"
          title="Delete"
          disabled={isScrolling}
          onClick={(e) => {
            e.stopPropagation();
            onAction(idMVC, 'deleteAction');
          }}
        >
          🗑
        </button>
      )}
    </div>
  );
}
