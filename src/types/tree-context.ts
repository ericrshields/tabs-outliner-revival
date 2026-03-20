import type { HoveringMenuActionId } from './node';
import type { NodeDTO } from './node-dto';
import type { EditKind } from '@/view/hooks/use-tree-data';

export type { EditKind };

export interface HoveringMenuActions {
  actions: NodeDTO['hoveringMenuActions'];
  idMVC: string;
}

export interface TreeContextValue {
  cursorId: string | null;
  hoveredId: string | null;
  singleClickActivation: boolean;
  onRowEnter: (id: string, actions: HoveringMenuActions, rect: DOMRect) => void;
  onAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
  /** idMVC of the node currently being edited inline, or null. */
  editingId: string | null;
  /** Pre-filled text for the inline edit input. */
  editDefaultText: string;
  /** Commit the inline edit — posts the appropriate text-update message. */
  onEditComplete: (idMVC: string, newText: string, kind: EditKind) => void;
  /** Cancel the inline edit without saving. */
  onEditCancel: () => void;
  /** Open the context menu for the given node at (x, y). */
  onContextMenu: (
    idMVC: string,
    nodeDTO: NodeDTO,
    x: number,
    y: number,
  ) => void;
  /** Called when the user clicks a node — sets the stable keyboard shortcut target. */
  onNodeClick: (idMVC: string) => void;
  /** Whether the in-memory clipboard has a cut/copy entry. */
  hasClipboard: boolean;
}
