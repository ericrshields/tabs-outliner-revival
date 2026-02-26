import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Tree } from 'react-arborist';
import type { TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import type { HoveringMenuActionId } from '@/types/node';
import {
  usePort,
  useTreeData,
  useWindowSize,
  nodeId,
  nodeChildren,
  buildOpenMap,
  activateNode,
  toggleCollapse,
  executeAction,
  notifyUnload,
  requestTree,
  importTree,
} from '@/view/index';
import { TreeContext } from './components/TreeContext';
import type { HoveringMenuActions, TreeContextValue } from './components/TreeContext';
import { NodeRow } from './components/NodeRow';
import { HoveringMenu } from './components/HoveringMenu';
import { EmptyTreeImport } from './components/EmptyTreeImport';

export function App() {
  const treeRef = useRef<TreeApi<NodeDTO>>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const { state, isLoading, handleMessage } = useTreeData();
  const { height: windowHeight } = useWindowSize();

  // Guard: suppress onToggle during programmatic open/close sync
  const isSyncingRef = useRef(false);

  const onReconnect = useCallback(() => {
    postMessage(requestTree());
  }, []);

  const { postMessage, connectionState } = usePort(handleMessage, onReconnect);

  // Hover state for hovering menu.
  // Menu is visible whenever the mouse is inside the tree container.
  // Row association updates on mouseenter of each row (no mouseleave needed).
  // Menu hides only when the mouse leaves the tree container entirely,
  // or when the tree scrolls (stale position).
  const [hoverState, setHoverState] = useState<{
    idMVC: string;
    actions: HoveringMenuActions;
    rect: DOMRect;
  } | null>(null);

  const handleRowEnter = useCallback(
    (
      id: string,
      actions: HoveringMenuActions,
      rect: DOMRect,
    ) => {
      setHoverState({ idMVC: id, actions, rect });
    },
    [],
  );

  const clearHover = useCallback(() => {
    setHoverState(null);
  }, []);

  const handleAction = useCallback(
    (idMVC: string, actionId: HoveringMenuActionId) => {
      postMessage(executeAction(idMVC, actionId));
      setHoverState(null);
    },
    [postMessage],
  );

  // Clear hover menu on scroll (position becomes stale)
  useEffect(() => {
    const container = treeContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', clearHover, true);
    return () => container.removeEventListener('scroll', clearHover, true);
  }, [clearHover]);

  // Stable context value
  const ctxValue: TreeContextValue = useMemo(
    () => ({
      cursorId: state.selectedId ?? null,
      onRowEnter: handleRowEnter,
      onAction: handleAction,
    }),
    [state.selectedId, handleRowEnter, handleAction],
  );

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

  // Trigger file download when export is ready
  useEffect(() => {
    if (!state.exportJson) return;
    const blob = new Blob([state.exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabs-outliner-backup-${new Date().toISOString().slice(0, 10)}.tree`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.exportJson]);

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
      ) : state.root && state.root.subnodes.length === 0 ? (
        <EmptyTreeImport
          onImport={(json) => postMessage(importTree(json))}
          importResult={state.importResult}
        />
      ) : (
        <div ref={treeContainerRef} onMouseLeave={clearHover}>
          <TreeContext.Provider value={ctxValue}>
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
              height={windowHeight}
              rowHeight={24}
              indent={20}
              disableDrag
              disableDrop
            >
              {NodeRow}
            </Tree>
          </TreeContext.Provider>
          {hoverState && (
            <HoveringMenu
              idMVC={hoverState.idMVC}
              actions={hoverState.actions.actions}
              anchorRect={hoverState.rect}
              onAction={handleAction}
            />
          )}
        </div>
      )}
    </div>
  );
}
