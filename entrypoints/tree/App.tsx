import { useRef, useCallback } from 'react';
import { Tree, type TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import {
  usePort,
  useTreeData,
  useWindowSize,
  useTreeSync,
  useTreeInteractions,
  useTreeDrop,
  nodeId,
  nodeChildren,
  requestTree,
} from '@/view/index';
import { TreeContext } from './components/TreeContext';
import { NodeRow } from './components/NodeRow';
import { ClickRow } from './components/ClickRow';
import { HoveringMenu } from './components/HoveringMenu';
import { FirstRunImport } from './components/FirstRunImport';
import { ExportToolbar } from './components/ExportToolbar';

/** Height of the fixed export toolbar (padding + button + border). */
const EXPORT_TOOLBAR_HEIGHT = 36;

export function App() {
  const treeRef = useRef<TreeApi<NodeDTO>>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const { state, isLoading, handleMessage, clearExport, clearExportHtml } =
    useTreeData();
  const { height: windowHeight } = useWindowSize();
  // postMessage is stable (useCallback with [] deps in usePort) — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onReconnect = useCallback(() => postMessage(requestTree()), []);
  const { postMessage, connectionState } = usePort(handleMessage, onReconnect);

  const { onToggle, onActivate } = useTreeSync({
    treeRef,
    root: state.root,
    globalViewId: state.globalViewId,
    needsFullRefresh: state.needsFullRefresh,
    postMessage,
  });
  const { hoverState, clearHover, handleAction, ctxValue } =
    useTreeInteractions({
      postMessage,
      treeContainerRef,
      selectedId: state.selectedId,
    });
  const {
    showFirstRun,
    dismissFirstRun,
    isExternalDragOver,
    handleTreeDragOver,
    handleTreeDragLeave,
    handleTreeDrop,
    handleImport,
  } = useTreeDrop({
    postMessage,
    importResult: state.importResult,
    exportJson: state.exportJson,
    exportHtml: state.exportHtml,
    clearExport,
    clearExportHtml,
  });

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
            <div className="external-drop-indicator">Drop to import tree</div>
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
              renderRow={ClickRow}
              selection={state.selectedId ?? undefined}
              width="100%"
              height={windowHeight - EXPORT_TOOLBAR_HEIGHT - 10}
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
      {!isLoading && <ExportToolbar postMessage={postMessage} />}
    </div>
  );
}
