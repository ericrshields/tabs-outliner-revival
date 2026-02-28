import { createContext } from 'react';
import type { HoveringMenuActionId } from '@/types/node';
import type { NodeDTO } from '@/types/node-dto';

export interface HoveringMenuActions {
  actions: NodeDTO['hoveringMenuActions'];
  idMVC: string;
}

export interface TreeContextValue {
  cursorId: string | null;
  singleClickActivation: boolean;
  onRowEnter: (
    id: string,
    actions: HoveringMenuActions,
    rect: DOMRect,
  ) => void;
  onAction: (idMVC: string, actionId: HoveringMenuActionId) => void;
}

export const TreeContext = createContext<TreeContextValue>({
  cursorId: null,
  singleClickActivation: false,
  onRowEnter: () => {},
  onAction: () => {},
});
