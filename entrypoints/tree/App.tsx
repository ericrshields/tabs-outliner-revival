import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
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
import { FirstRunImport } from './components/EmptyTreeImport';
import { extractTreeFromDrag } from './components/drag-import';

const FIRST_RUN_KEY = 'importDismissed';

export function App() {
  const treeRef = useRef<TreeApi<NodeDTO>>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const { state, isLoading, handleMessage } = useTreeData();
  const { height: windowHeight } = useWindowSize();

  // First-run overlay: shown until dismissed or import succeeds
  const [showFirstRun, setShowFirstRun] = useState(
    () => !localStorage.getItem(FIRST_RUN_KEY),
  );

  const dismissFirstRun = useCallback(() => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    setShowFirstRun(false);
  }, []);

  // Auto-dismiss after successful import
  useEffect(() => {
    if (state.importResult?.success) {
      dismissFirstRun();
    }
  }, [state.importResult, dismissFirstRun]);

  // Guard: suppress onToggle during programmatic open/close sync
  const isSyncingRef = useRef(false);

  const onReconnect = useCallback(() => {
    postMessage(requestTree());
  }, []);

  const { postMessage, connectionState } = usePort(handleMessage, onReconnect);

  // Import handler shared by overlay and tree container drop
  const handleImport = useCallback(
    (json: string) => postMessage(importTree(json)),
    [postMessage],
  );

  // External drop on tree container (legacy extension DnD)
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);

  const handleTreeDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    // Only handle external drags (not react-arborist internal ones)
    const dt = e.dataTransfer;
    if (!dt) return;
    const types = Array.from(dt.types);
    const isExternal =
      types.includes('application/x-tabsoutliner-items') ||
      types.includes('text/html') ||
      types.includes('Files');
    if (isExternal) {
      e.preventDefault();
      setIsExternalDragOver(true);
    }
  }, []);

  const handleTreeDragLeave = useCallback(() => {
    setIsExternalDragOver(false);
  }, []);

  const handleTreeDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer) return;

      // Try extracting tree data from legacy extension DnD
      const treeJson = extractTreeFromDrag(e.dataTransfer as unknown as DataTransfer);
      if (treeJson) {
        e.preventDefault();
        setIsExternalDragOver(false);
        handleImport(treeJson);
        return;
      }

      // File drop
      const file = e.dataTransfer.files?.[0];
      if (file) {
        e.preventDefault();
        setIsExternalDragOver(false);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            handleImport(reader.result);
          }
        };
        reader.readAsText(file);
      }
    },
    [handleImport],
  );

  // Hover state for hovering menu
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
      ) : (
        <div
          ref={treeContainerRef}
          onMouseLeave={clearHover}
          onDragOver={handleTreeDragOver}
          onDragLeave={handleTreeDragLeave}
          onDrop={handleTreeDrop}
        >
          {isExternalDragOver && (
            <div className="external-drop-indicator">
              Drop to import tree
            </div>
          )}
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
      {showFirstRun && !isLoading && (
        <FirstRunImport
          onImport={handleImport}
          onDismiss={dismissFirstRun}
          importResult={state.importResult}
        />
      )}
    </div>
  );
}
