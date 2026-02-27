/**
 * Tree state management hook with incremental patching.
 *
 * Uses `useReducer` for immutable state transitions and `useRef` for
 * mutable indexes (node and parent maps) that don't trigger re-renders.
 *
 * Incremental updates for NODE_UPDATED and NODE_REMOVED. Structural
 * changes (moves, replaces, window closes) trigger a full re-request.
 */

import { useReducer, useRef, useCallback } from 'react';
import type { NodeDTO } from '@/types/node-dto';
import type {
  BackgroundToViewMessage,
  Msg_InitTreeView,
  Msg_NotifyObserver,
  Msg_NotifyObserverOnNodeUpdated,
  Msg_SetCursorHere,
  Msg_ImportResult,
  Msg_ExportResult,
} from '@/types/messages';
import { buildOpenMap } from '../tree-adapter';

// -- State types --

export interface ImportResultState {
  success: boolean;
  nodeCount: number;
  error?: string;
}

export interface TreeState {
  root: NodeDTO | null;
  selectedId: string | null;
  globalViewId: number | null;
  instanceId: string | null;
  initialOpenMap: Record<string, boolean> | null;
  needsFullRefresh: boolean;
  importResult: ImportResultState | null;
  exportJson: string | null;
}

const INITIAL_STATE: TreeState = {
  root: null,
  selectedId: null,
  globalViewId: null,
  instanceId: null,
  initialOpenMap: null,
  needsFullRefresh: false,
  importResult: null,
  exportJson: null,
};

// -- Reducer actions --

type TreeAction =
  | { type: 'INIT'; msg: Msg_InitTreeView }
  | { type: 'NODE_UPDATED'; idMVC: string; modelDataCopy: NodeDTO }
  | { type: 'NODE_REMOVED'; idMVC: string }
  | { type: 'SET_CURSOR'; targetId: string }
  | { type: 'FULL_REFRESH_NEEDED' }
  | { type: 'IMPORT_RESULT'; success: boolean; nodeCount: number; error?: string }
  | { type: 'EXPORT_READY'; treeJson: string };

// -- Index types --

interface Indexes {
  nodeIndex: Map<string, NodeDTO>;
  parentIndex: Map<string, string>;
}

// -- Index building --

function buildIndexes(root: NodeDTO): Indexes {
  const nodeIndex = new Map<string, NodeDTO>();
  const parentIndex = new Map<string, string>();

  function walk(node: NodeDTO, parentId: string | null): void {
    nodeIndex.set(node.idMVC, node);
    if (parentId !== null) {
      parentIndex.set(node.idMVC, parentId);
    }
    for (const child of node.subnodes) {
      walk(child, node.idMVC);
    }
  }

  walk(root, null);
  return { nodeIndex, parentIndex };
}

// -- Immutable path cloning --

/**
 * Clone the path from a target node up to the root, replacing the
 * target node in its parent's subnodes array. Returns a new root.
 *
 * `replacementOrNull`:
 *   - NodeDTO: replace the node at its position
 *   - null: remove the node from parent's subnodes
 */
function clonePathToRoot(
  targetId: string,
  replacementOrNull: NodeDTO | null,
  indexes: Indexes,
): NodeDTO | null {
  const { nodeIndex, parentIndex } = indexes;

  // Build the path from target to root
  const path: string[] = [targetId];
  let currentId = targetId;
  while (parentIndex.has(currentId)) {
    currentId = parentIndex.get(currentId)!;
    path.push(currentId);
  }

  // Clone bottom-up
  let currentReplacement = replacementOrNull;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];

    if (i === 0) {
      // This is the target node — use the replacement directly
      continue;
    }

    const parentNode = nodeIndex.get(nodeId);
    if (!parentNode) return null;

    const childId = path[i - 1];
    let newSubnodes: NodeDTO[];

    if (currentReplacement === null) {
      // Remove mode
      newSubnodes = parentNode.subnodes.filter((s) => s.idMVC !== childId);
    } else {
      // Replace mode
      newSubnodes = parentNode.subnodes.map((s) =>
        s.idMVC === childId ? currentReplacement! : s,
      );
    }

    currentReplacement = { ...parentNode, subnodes: newSubnodes };
  }

  return currentReplacement;
}

// -- Reducer --

function createReducer(indexesRef: { current: Indexes }) {
  return function treeReducer(state: TreeState, action: TreeAction): TreeState {
    switch (action.type) {
      case 'INIT': {
        const root = action.msg.rootNode_currentSession;
        const indexes = buildIndexes(root);
        indexesRef.current = indexes;

        return {
          root,
          selectedId: null,
          globalViewId: action.msg.globalViewId,
          instanceId: action.msg.instanceId,
          initialOpenMap: buildOpenMap(root),
          needsFullRefresh: false,
          importResult: null,
          exportJson: null,
        };
      }

      case 'NODE_UPDATED': {
        if (!state.root) return state;

        const { nodeIndex } = indexesRef.current;
        const existing = nodeIndex.get(action.idMVC);

        if (!existing) {
          // Unknown node — likely a new tab. Request full refresh.
          return { ...state, needsFullRefresh: true };
        }

        // Use the update's subnodes if present (expand sends children).
        // Preserve existing subnodes only when the node is collapsed
        // (subnodes:[] but isSubnodesPresent:true = hidden children).
        const updateData = action.modelDataCopy;
        const subnodes =
          updateData.subnodes.length > 0
            ? updateData.subnodes
            : updateData.isSubnodesPresent
              ? existing.subnodes
              : [];
        const updatedNode: NodeDTO = { ...updateData, subnodes };

        const newRoot = clonePathToRoot(
          action.idMVC,
          updatedNode,
          indexesRef.current,
        );

        if (!newRoot) return { ...state, needsFullRefresh: true };

        // Update indexes
        const newIndexes = buildIndexes(newRoot);
        indexesRef.current = newIndexes;

        return { ...state, root: newRoot, needsFullRefresh: false };
      }

      case 'NODE_REMOVED': {
        if (!state.root) return state;

        // Root removal is not recoverable via incremental patch
        if (action.idMVC === state.root.idMVC) {
          console.error('useTreeData: received NODE_REMOVED for root node');
          return state;
        }

        const { nodeIndex } = indexesRef.current;
        if (!nodeIndex.has(action.idMVC)) {
          // Node already removed or unknown — ignore
          return state;
        }

        const newRoot = clonePathToRoot(
          action.idMVC,
          null,
          indexesRef.current,
        );

        if (!newRoot) return { ...state, needsFullRefresh: true };

        const newIndexes = buildIndexes(newRoot);
        indexesRef.current = newIndexes;

        return { ...state, root: newRoot, needsFullRefresh: false };
      }

      case 'SET_CURSOR':
        return { ...state, selectedId: action.targetId };

      case 'FULL_REFRESH_NEEDED':
        return { ...state, needsFullRefresh: true };

      case 'IMPORT_RESULT':
        return {
          ...state,
          importResult: {
            success: action.success,
            nodeCount: action.nodeCount,
            error: action.error,
          },
        };

      case 'EXPORT_READY':
        return { ...state, exportJson: action.treeJson };

      default:
        return state;
    }
  };
}

// -- Hook --

export interface UseTreeDataReturn {
  state: TreeState;
  isLoading: boolean;
  handleMessage: (msg: BackgroundToViewMessage) => void;
}

export function useTreeData(): UseTreeDataReturn {
  const indexesRef = useRef<Indexes>({
    nodeIndex: new Map(),
    parentIndex: new Map(),
  });

  const reducerRef = useRef(createReducer(indexesRef));
  const [state, dispatch] = useReducer(reducerRef.current, INITIAL_STATE);

  const handleMessage = useCallback((msg: BackgroundToViewMessage) => {
    switch (msg.command) {
      case 'msg2view_initTreeView':
        dispatch({ type: 'INIT', msg: msg as Msg_InitTreeView });
        break;

      case 'msg2view_notifyObserver_onNodeUpdated': {
        const updated = msg as Msg_NotifyObserverOnNodeUpdated;
        dispatch({
          type: 'NODE_UPDATED',
          idMVC: updated.idMVC,
          modelDataCopy: updated.modelDataCopy,
        });
        break;
      }

      case 'msg2view_notifyObserver': {
        const notify = msg as Msg_NotifyObserver;
        const eventName = notify.parameters[0];

        switch (eventName) {
          case 'onNodeRemoved':
            dispatch({ type: 'NODE_REMOVED', idMVC: notify.idMVC });
            break;
          case 'onNodeMoved':
          case 'onNodeReplaced':
          case 'onWindowClosed':
          case 'onParentUpdated':
            dispatch({ type: 'FULL_REFRESH_NEEDED' });
            break;
          default:
            console.warn('useTreeData: unknown observer event', eventName);
            dispatch({ type: 'FULL_REFRESH_NEEDED' });
        }
        break;
      }

      case 'msg2view_setCursorHere': {
        const cursor = msg as Msg_SetCursorHere;
        dispatch({ type: 'SET_CURSOR', targetId: cursor.targetNodeIdMVC });
        break;
      }

      case 'msg2view_importResult': {
        const result = msg as Msg_ImportResult;
        dispatch({
          type: 'IMPORT_RESULT',
          success: result.success,
          nodeCount: result.nodeCount,
          error: result.error,
        });
        break;
      }

      case 'msg2view_exportResult': {
        const result = msg as Msg_ExportResult;
        if (result.success && result.treeJson) {
          dispatch({ type: 'EXPORT_READY', treeJson: result.treeJson });
        }
        break;
      }

      default:
        // Messages not handled by tree data (scroll, drag, edit prompts, etc.)
        // are silently ignored — they'll be handled by other hooks in later epics.
        break;
    }
  }, []);

  return {
    state,
    isLoading: state.root === null,
    handleMessage,
  };
}
