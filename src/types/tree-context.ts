import type { HoveringMenuActionId } from './node';
import type { NodeDTO } from './node-dto';

export interface HoveringMenuActions {
  actions: NodeDTO['hoveringMenuActions'];
  idMVC: string;
}

export interface TreeContextValue {
  cursorId: string | null;
  hoveredId: string | null;
  singleClickActivation: boolean;
  onRowEnter: (
    id: string,
    actions: HoveringMenuActions,
    rect: DOMRect,
  ) => void;
  onAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
}
