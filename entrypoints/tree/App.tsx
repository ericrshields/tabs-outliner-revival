import { useRef, useEffect, useCallback } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import type { TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import {
  usePort,
  useTreeData,
  nodeId,
  nodeChildren,
  buildOpenMap,
  activateNode,
  toggleCollapse,
  notifyUnload,
  requestTree,
} from '@/view/index';

function Node({ node, style, dragHandle }: NodeRendererProps<NodeDTO>) {
  const data = node.data;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`tree-node ${node.isSelected ? 'selected' : ''} ${data.titleBackgroundCssClass}`}
    >
      <span
        className="node-arrow"
        onClick={(e) => {
          if (node.isInternal) {
            e.stopPropagation();
            node.toggle();
          }
        }}
      >
        {node.isInternal ? (node.isOpen ? '\u25BC' : '\u25B6') : ' '}
      </span>
      {data._getIcon && (
        <img className="node-icon" src={data._getIcon} alt="" />
      )}
      <span className="node-name">{data._getNodeText}</span>
    </div>
  );
}

export function App() {
  const treeRef = useRef<TreeApi<NodeDTO>>(null);
  const { state, isLoading, handleMessage } = useTreeData();

  // Guard: suppress onToggle during programmatic open/close sync
  const isSyncingRef = useRef(false);

  const onReconnect = useCallback(() => {
    postMessage(requestTree());
  }, []);

  const { postMessage, connectionState } = usePort(handleMessage, onReconnect);

  // Request tree on mount
  useEffect(() => {
    postMessage(requestTree());
  }, [postMessage]);

  // Re-request tree when background signals a structural change
  useEffect(() => {
    if (state.needsFullRefresh) {
      postMessage(requestTree());
    }
  }, [state.needsFullRefresh, postMessage]);

  // Best-effort save on unload
  useEffect(() => {
    const handler = () => postMessage(notifyUnload());
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [postMessage]);

  // Sync react-arborist open/close state from background updates
  const prevOpenMapRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!treeRef.current || !state.root) return;

    const currentMap = buildOpenMap(state.root);

    // Compare with previous map and apply differences
    const prev = prevOpenMapRef.current;
    if (prev) {
      isSyncingRef.current = true;
      try {
        for (const [id, isOpen] of Object.entries(currentMap)) {
          // Skip nodes not in prev (new nodes) — initialOpenState handles them
          if (prev[id] === undefined) continue;
          if (prev[id] !== isOpen) {
            if (isOpen) {
              treeRef.current!.open(id);
            } else {
              treeRef.current!.close(id);
            }
          }
        }
      } finally {
        isSyncingRef.current = false;
      }
    }
    prevOpenMapRef.current = currentMap;
  }, [state.root]);

  const onToggle = useCallback(
    (id: string) => {
      // Skip programmatic toggles from sync effect
      if (isSyncingRef.current) return;
      postMessage(toggleCollapse(id));
    },
    [postMessage],
  );

  const onActivate = useCallback(
    (node: { data: NodeDTO } | null) => {
      if (node) {
        postMessage(activateNode(node.data.idMVC));
      }
    },
    [postMessage],
  );

  return (
    <div className="tree-view-container">
      {connectionState !== 'connected' && (
        <div className="connection-banner">
          {connectionState === 'connecting'
            ? 'Reconnecting to background...'
            : 'Disconnected from background'}
        </div>
      )}
      {isLoading ? (
        <div className="loading">Loading tree...</div>
      ) : (
        <Tree<NodeDTO>
          ref={treeRef}
          data={state.root?.subnodes ?? []}
          idAccessor={nodeId}
          childrenAccessor={nodeChildren}
          initialOpenState={state.initialOpenMap ?? {}}
          onToggle={onToggle}
          onActivate={onActivate}
          selection={state.selectedId ?? undefined}
          width="100%"
          height={window.innerHeight}
          rowHeight={24}
          indent={20}
          disableDrag
          disableDrop
        >
          {Node}
        </Tree>
      )}
    </div>
  );
}
