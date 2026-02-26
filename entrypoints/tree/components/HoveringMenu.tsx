import type { HoveringMenuActionId } from '@/types/node';
import type { NodeDTO } from '@/types/node-dto';

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
  const hasClose = !!actions.closeAction;
  const hasDelete = !!actions.deleteAction;

  if (!hasClose && !hasDelete) return null;

  const style: Record<string, string | number> = {
    top: `${anchorRect.top}px`,
    left: `${anchorRect.right - 60}px`,
  };

  return (
    <div className="hovering-menu" style={style}>
      {hasClose && (
        <button
          className="hovering-menu-btn"
          title="Close"
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
