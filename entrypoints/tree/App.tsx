import { useRef, useCallback, useState, useEffect } from 'react';
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
import { MainToolbar } from './components/MainToolbar';

/** Height of the fixed combined toolbar at the bottom. */
const TOOLBAR_HEIGHT = 32;
/** Row height as configured on the Tree component. */
const ROW_HEIGHT = 24;

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
    localCursorId,
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
    selectedId: localCursorId,
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

  // Scroll compensator: pad the bottom of the tree so the last node can
  // be scrolled all the way to the top of the viewport.
  const [scrollPadding, setScrollPadding] = useState(0);
  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setScrollPadding(Math.max(0, entry.contentRect.height - ROW_HEIGHT));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
                // Offset left by arrow width (14px) + flex gap (4px) so the
                // drop indicator aligns with node text start.
                <div
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    top: `${top - 2}px`,
                    left: `${left + 18}px`,
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
              selection={localCursorId ?? undefined}
              width="100%"
              height={windowHeight - TOOLBAR_HEIGHT - 10}
              rowHeight={ROW_HEIGHT}
              paddingBottom={scrollPadding}
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
      {!isLoading && (
        <MainToolbar
          cursorIdRef={lastKeyboardTargetId}
          postMessage={postMessage}
        />
      )}
    </div>
  );
}
