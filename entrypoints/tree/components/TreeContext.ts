import { createContext } from 'react';
import type { TreeContextValue } from '@/types/tree-context';

export type {
  HoveringMenuActions,
  TreeContextValue,
} from '@/types/tree-context';

export const TreeContext = createContext<TreeContextValue>({
  cursorId: null,
  hoveredId: null,
  singleClickActivation: false,
  onRowEnter: () => {},
  onAction: () => {},
  editingId: null,
  editDefaultText: '',
  onEditComplete: () => {},
  onEditCancel: () => {},
  onContextMenu: () => {},
  onNodeClick: () => {},
  hasClipboard: false,
  isScrolling: false,
});
