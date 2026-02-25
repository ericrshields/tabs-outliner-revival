/**
 * View module barrel export.
 *
 * Re-exports hooks, adapters, and action constructors used by the
 * tree view entrypoint (App.tsx).
 */

export { usePort } from './hooks/use-port';
export type { UsePortReturn } from './hooks/use-port';

export { useTreeData } from './hooks/use-tree-data';
export type { TreeState, UseTreeDataReturn } from './hooks/use-tree-data';

export { nodeId, nodeChildren, buildOpenMap } from './tree-adapter';
export {
  requestTree,
  activateNode,
  toggleCollapse,
  executeAction,
  notifyUnload,
} from './tree-actions';
