import { useRef, useCallback } from 'react';
import { Tree, type TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import type { HoveringMenuActionId } from '@/types/node';
import {
  usePort,
  useTreeData,
  useWindowSize,
  useTreeSync,
  useTreeInteractions,
  useTreeDrop,
  useClipboard,
  useContextMenu,
  useKeyboardShortcuts,
  nodeId,
  nodeChildren,
  requestTree,
  moveHierarchy,
  executeAction,
  activateNode,
} from '@/view/index';
import { TreeContext } from './components/TreeContext';
import { NodeRow } from './components/NodeRow';
import { ClickRow } from './components/ClickRow';
import { HoveringMenu } from './components/HoveringMenu';
import { ContextMenu } from './components/ContextMenu';
import { FirstRunImport } from './components/FirstRunImport';
import { ExportToolbar } from './components/ExportToolbar';

/** Height of the fixed export toolbar (padding + button + border). */
const EXPORT_TOOLBAR_HEIGHT = 36;

export function App() {
  const treeRef = useRef<TreeApi<NodeDTO>>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    isLoading,
    handleMessage,
    clearExport,
    clearExportHtml,
    clearEditing,
  } = useTreeData();
  const { height: windowHeight } = useWindowSize();
  // postMessage is stable (useCallback with [] deps in usePort) — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onReconnect = useCallback(() => postMessage(requestTree()), []);
  const { postMessage, connectionState } = usePort(handleMessage, onReconnect);

  const clipboard = useClipboard({ postMessage });
  const { contextMenuState, openContextMenu, closeContextMenu } =
    useContextMenu();

  const { onToggle, onActivate } = useTreeSync({
    treeRef,
    root: state.root,
    globalViewId: state.globalViewId,
    needsFullRefresh: state.needsFullRefresh,
    postMessage,
  });
  const {
    hoverState,
    clearHover,
    handleAction,
    ctxValue,
    lastKeyboardTargetId,
  } = useTreeInteractions({
    postMessage,
    treeContainerRef,
    selectedId: state.selectedId,
    editingNode: state.editingNode,
    clearEditing,
    onOpenContextMenu: openContextMenu,
    hasClipboard: clipboard.hasClipboard,
  });

  useKeyboardShortcuts({
    treeRef,
    postMessage,
    selectedId: state.selectedId,
    lastKeyboardTargetId,
    editingId: state.editingNode?.idMVC ?? null,
    clipboard,
    closeContextMenu,
    contextMenuOpen: contextMenuState !== null,
  });

  const handleTreeMove = useCallback(
    ({
      dragIds,
      parentId,
      index,
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      if (dragIds.length === 0) return;
      // Multi-drag not yet supported — only the first node is moved.
      if (dragIds.length > 1) {
        console.warn('[App] Multi-drag not supported; only moving first node');
      }
      postMessage(moveHierarchy(dragIds[0], parentId, index));
    },
    [postMessage],
  );

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
              onMove={handleTreeMove}
              renderRow={ClickRow}
              renderCursor={({ top, left, indent }) => (
                // Offset left by node-arrow width (~20px) so the drop indicator
                // aligns with the node text start rather than the row container edge.
                <div
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    top: `${top - 2}px`,
                    left: `${left + 20}px`,
                    right: `${indent}px`,
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      boxShadow: '0 0 0 3px #4B91E2',
                      borderRadius: '50%',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: '#4B91E2',
                      borderRadius: 1,
                    }}
                  />
                </div>
              )}
              selection={state.selectedId ?? undefined}
              width="100%"
              height={windowHeight - EXPORT_TOOLBAR_HEIGHT - 10}
              rowHeight={24}
              indent={20}
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
          {contextMenuState && (
            <ContextMenu
              idMVC={contextMenuState.idMVC}
              nodeDTO={contextMenuState.nodeDTO}
              x={contextMenuState.x}
              y={contextMenuState.y}
              hasClipboard={clipboard.hasClipboard}
              treeRef={treeRef}
              postMessage={postMessage}
              onAction={(id: string, actionId: HoveringMenuActionId) => {
                postMessage(executeAction(id, actionId));
                closeContextMenu();
              }}
              onCut={() => {
                clipboard.cut(
                  contextMenuState.idMVC,
                  contextMenuState.nodeDTO.nodeText ?? '',
                );
                closeContextMenu();
              }}
              onCopy={() => {
                clipboard.copy(
                  contextMenuState.idMVC,
                  contextMenuState.nodeDTO.nodeText ?? '',
                );
                closeContextMenu();
              }}
              onPaste={(parentId, pos) => {
                clipboard.paste(parentId, pos);
                closeContextMenu();
              }}
              onRestore={(id) => {
                postMessage(activateNode(id));
                closeContextMenu();
              }}
              onClose={closeContextMenu}
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
