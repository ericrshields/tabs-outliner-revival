// Tree model — barrel export

export { TreeNode } from './tree-node';
export { TreeModel } from './tree-model';
export { generateMvcId, resetMvcIdCounter } from './mvc-id';
export { deserializeNode, restoreTree } from './deserialize';
export { toNodeDTO, computeParentUpdate, computeParentUpdatesToRoot } from './dto';
export { CloseTracker } from './close-tracker';
export type { CloseRecord } from './close-tracker';
export type {
  TreeMutationResult,
  MutationListener,
  TreeModelOptions,
  DiffAccumulator,
} from './types';

// Node classes
export {
  SessionTreeNode,
  TabTreeNode,
  SavedTabTreeNode,
  WaitingTabTreeNode,
  AttachWaitTabTreeNode,
  WindowTreeNode,
  SavedWindowTreeNode,
  WaitingWindowTreeNode,
  GroupTreeNode,
  TextNoteTreeNode,
  SeparatorTreeNode,
} from './nodes';
