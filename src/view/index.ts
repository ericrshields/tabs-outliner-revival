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

export { useWindowSize } from './hooks/use-window-size';
export type { WindowSize } from './hooks/use-window-size';

export { useTreeSync } from './hooks/use-tree-sync';
export type {
  UseTreeSyncOptions,
  UseTreeSyncReturn,
} from './hooks/use-tree-sync';

export { useTreeInteractions } from './hooks/use-tree-interactions';
export type {
  UseTreeInteractionsOptions,
  UseTreeInteractionsReturn,
  HoverState,
} from './hooks/use-tree-interactions';

export { useTreeDrop } from './hooks/use-tree-drop';
export type {
  UseTreeDropOptions,
  UseTreeDropReturn,
} from './hooks/use-tree-drop';

export { useClipboard } from './hooks/use-clipboard';
export type {
  UseClipboardOptions,
  UseClipboardReturn,
  ClipboardKind,
} from './hooks/use-clipboard';

export { useContextMenu } from './hooks/use-context-menu';
export type {
  ContextMenuState,
  UseContextMenuReturn,
} from './hooks/use-context-menu';

export { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
export type { UseKeyboardShortcutsOptions } from './hooks/use-keyboard-shortcuts';

export { nodeId, nodeChildren, buildOpenMap } from './tree-adapter';
export {
  requestTree,
  activateNode,
  toggleCollapse,
  executeAction,
  notifyUnload,
  importTree,
  exportTree,
  exportTreeHtml,
  moveHierarchy,
  copyHierarchy,
  applyNodeTabText,
  applyNodeNoteText,
  applyNodeWindowText,
} from './tree-actions';
