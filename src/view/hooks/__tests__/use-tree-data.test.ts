import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useTreeData } from '../use-tree-data';
import { makeNodeDTO, makeTree, resetFixtureCounter } from '../../__tests__/fixtures';
import type { MvcId } from '@/types/brands';
import type {
  Msg_InitTreeView,
  Msg_NotifyObserverOnNodeUpdated,
  Msg_NotifyObserver,
  Msg_SetCursorHere,
  Msg_ImportResult,
  Msg_ExportResult,
  BackgroundToViewMessage,
} from '@/types/messages';

beforeEach(() => {
  resetFixtureCounter();
  vi.restoreAllMocks();
});

function makeInitMessage(root = makeTree()): Msg_InitTreeView {
  return {
    command: 'msg2view_initTreeView',
    rootNode_currentSession: root,
    globalViewId: 1,
    instanceId: 'test-instance',
  };
}

function makeNodeUpdatedMessage(
  idMVC: string,
  overrides: Record<string, unknown> = {},
): Msg_NotifyObserverOnNodeUpdated {
  const node = makeNodeDTO({ idMVC: idMVC as MvcId, ...overrides });
  return {
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC,
    modelDataCopy: node,
  };
}

function makeNotifyMessage(
  idMVC: string,
  eventName: string,
): Msg_NotifyObserver {
  return {
    command: 'msg2view_notifyObserver',
    idMVC,
    parameters: [eventName],
  };
}

function makeCursorMessage(targetId: string): Msg_SetCursorHere {
  return {
    command: 'msg2view_setCursorHere',
    targetNodeIdMVC: targetId,
    doNotScrollView: false,
  };
}

describe('useTreeData', () => {
  describe('initial state', () => {
    it('starts with null root and loading true', () => {
      const { result } = renderHook(() => useTreeData());

      expect(result.current.state.root).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.state.selectedId).toBeNull();
      expect(result.current.state.globalViewId).toBeNull();
      expect(result.current.state.instanceId).toBeNull();
      expect(result.current.state.initialOpenMap).toBeNull();
      expect(result.current.state.needsFullRefresh).toBe(false);
    });

  });

  describe('INIT (msg2view_initTreeView)', () => {
    it('sets root from init message', () => {
      const { result } = renderHook(() => useTreeData());
      const initMsg = makeInitMessage();

      act(() => result.current.handleMessage(initMsg));

      expect(result.current.state.root).not.toBeNull();
      expect(result.current.state.root!.idMVC).toBe('root');
      expect(result.current.isLoading).toBe(false);
    });

    it('sets globalViewId and instanceId', () => {
      const { result } = renderHook(() => useTreeData());

      act(() => result.current.handleMessage(makeInitMessage()));

      expect(result.current.state.globalViewId).toBe(1);
      expect(result.current.state.instanceId).toBe('test-instance');
    });

    it('computes initialOpenMap from the tree', () => {
      const { result } = renderHook(() => useTreeData());

      act(() => result.current.handleMessage(makeInitMessage()));

      const map = result.current.state.initialOpenMap!;
      expect(map).not.toBeNull();
      // root, win1, win3 are open; win2 is collapsed
      expect(map['root']).toBe(true);
      expect(map['win1']).toBe(true);
      expect(map['win2']).toBe(false);
      expect(map['win3']).toBe(true);
    });

    it('clears needsFullRefresh on init', () => {
      const { result } = renderHook(() => useTreeData());

      // Set up a state that needs refresh
      act(() => result.current.handleMessage(makeInitMessage()));
      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('win1', 'onNodeMoved'),
        );
      });
      expect(result.current.state.needsFullRefresh).toBe(true);

      // Re-init clears it
      act(() => result.current.handleMessage(makeInitMessage()));
      expect(result.current.state.needsFullRefresh).toBe(false);
    });

    it('resets selectedId on init', () => {
      const { result } = renderHook(() => useTreeData());

      act(() => result.current.handleMessage(makeInitMessage()));
      act(() => result.current.handleMessage(makeCursorMessage('tab1')));
      expect(result.current.state.selectedId).toBe('tab1');

      act(() => result.current.handleMessage(makeInitMessage()));
      expect(result.current.state.selectedId).toBeNull();
    });
  });

  describe('NODE_UPDATED (msg2view_notifyObserver_onNodeUpdated)', () => {
    it('updates a known node in the tree', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const updateMsg = makeNodeUpdatedMessage('tab1', {
        nodeText: 'Updated GitHub',
      });

      act(() => result.current.handleMessage(updateMsg));

      // Find tab1 in the tree
      const win1 = result.current.state.root!.subnodes[0];
      const tab1 = win1.subnodes[0];
      expect(tab1.nodeText).toBe('Updated GitHub');
    });

    it('preserves subnodes when update is for a collapsed node', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      // win1 has 2 children (tab1, tab2). Send an update that indicates
      // the node is collapsed (subnodes:[] but isSubnodesPresent:true).
      const updateMsg = makeNodeUpdatedMessage('win1', {
        nodeText: 'Updated Window',
        isSubnodesPresent: true,
      });

      act(() => result.current.handleMessage(updateMsg));

      const win1 = result.current.state.root!.subnodes[0];
      expect(win1.nodeText).toBe('Updated Window');
      expect(win1.subnodes).toHaveLength(2);
      expect(win1.subnodes[0].idMVC).toBe('tab1');
    });

    it('creates a new root (immutable update)', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const rootBefore = result.current.state.root;

      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('tab1', { nodeText: 'Changed' }),
        );
      });

      expect(result.current.state.root).not.toBe(rootBefore);
    });

    it('sets needsFullRefresh for unknown node ID', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('unknown-node', { nodeText: 'New Tab' }),
        );
      });

      expect(result.current.state.needsFullRefresh).toBe(true);
    });

    it('does nothing before init', () => {
      const { result } = renderHook(() => useTreeData());

      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('tab1', { nodeText: 'Changed' }),
        );
      });

      expect(result.current.state.root).toBeNull();
    });
  });

  describe('NODE_REMOVED (msg2view_notifyObserver → onNodeRemoved)', () => {
    it('removes a node from its parent subnodes', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      // win1 initially has tab1 and tab2
      expect(result.current.state.root!.subnodes[0].subnodes).toHaveLength(2);

      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('tab1', 'onNodeRemoved'),
        );
      });

      const win1 = result.current.state.root!.subnodes[0];
      expect(win1.subnodes).toHaveLength(1);
      expect(win1.subnodes[0].idMVC).toBe('tab2');
    });

    it('ignores removal of unknown node', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const rootBefore = result.current.state.root;

      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('nonexistent', 'onNodeRemoved'),
        );
      });

      // State unchanged (same reference)
      expect(result.current.state.root).toBe(rootBefore);
    });

    it('does nothing before init', () => {
      const { result } = renderHook(() => useTreeData());

      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('tab1', 'onNodeRemoved'),
        );
      });

      expect(result.current.state.root).toBeNull();
    });

    it('ignores removal of the root node (not recoverable)', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('root', 'onNodeRemoved'),
        );
      });

      // Root should be preserved, not null or needsFullRefresh
      expect(result.current.state.root).not.toBeNull();
      expect(result.current.state.root!.idMVC).toBe('root');
      expect(result.current.state.needsFullRefresh).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'useTreeData: received NODE_REMOVED for root node',
      );
    });
  });

  describe('FULL_REFRESH_NEEDED triggers', () => {
    const structuralEvents = [
      'onNodeMoved',
      'onNodeReplaced',
      'onWindowClosed',
      'onParentUpdated',
    ];

    it.each(structuralEvents)(
      'sets needsFullRefresh for %s',
      (eventName) => {
        const { result } = renderHook(() => useTreeData());
        act(() => result.current.handleMessage(makeInitMessage()));

        act(() => {
          result.current.handleMessage(
            makeNotifyMessage('win1', eventName),
          );
        });

        expect(result.current.state.needsFullRefresh).toBe(true);
      },
    );

    it('sets needsFullRefresh for unknown observer event', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('win1', 'onSomethingUnexpected'),
        );
      });

      expect(result.current.state.needsFullRefresh).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        'useTreeData: unknown observer event',
        'onSomethingUnexpected',
      );
    });
  });

  describe('SET_CURSOR (msg2view_setCursorHere)', () => {
    it('sets selectedId', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => {
        result.current.handleMessage(makeCursorMessage('tab2'));
      });

      expect(result.current.state.selectedId).toBe('tab2');
    });

    it('updates selectedId when cursor moves', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => result.current.handleMessage(makeCursorMessage('tab1')));
      act(() => result.current.handleMessage(makeCursorMessage('tab2')));

      expect(result.current.state.selectedId).toBe('tab2');
    });
  });

  describe('unhandled messages', () => {
    it('silently ignores messages not handled by tree data', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const rootBefore = result.current.state.root;

      act(() => {
        result.current.handleMessage({
          command: 'msg2view_onDragStartedInSomeView',
          currentlyDragedIdMVC: 'tab1',
        } as BackgroundToViewMessage);
      });

      // State unchanged
      expect(result.current.state.root).toBe(rootBefore);
    });
  });

  describe('index consistency after multiple operations', () => {
    it('handles sequential updates correctly', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      // Update tab1
      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('tab1', { nodeText: 'First Update' }),
        );
      });

      // Update tab2
      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('tab2', { nodeText: 'Second Update' }),
        );
      });

      const win1 = result.current.state.root!.subnodes[0];
      expect(win1.subnodes[0].nodeText).toBe('First Update');
      expect(win1.subnodes[1].nodeText).toBe('Second Update');
    });

    it('handles remove then update on sibling', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      // Remove tab1
      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('tab1', 'onNodeRemoved'),
        );
      });

      // Update tab2 (now the only child of win1)
      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('tab2', { nodeText: 'Still Here' }),
        );
      });

      const win1 = result.current.state.root!.subnodes[0];
      expect(win1.subnodes).toHaveLength(1);
      expect(win1.subnodes[0].nodeText).toBe('Still Here');
    });

    it('handles re-init after incremental updates', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      // Do some updates
      act(() => {
        result.current.handleMessage(
          makeNodeUpdatedMessage('tab1', { nodeText: 'Changed' }),
        );
      });
      act(() => {
        result.current.handleMessage(
          makeNotifyMessage('tab2', 'onNodeRemoved'),
        );
      });

      // Re-init with fresh tree
      act(() => result.current.handleMessage(makeInitMessage()));

      // Tree should be fresh
      const win1 = result.current.state.root!.subnodes[0];
      expect(win1.subnodes).toHaveLength(2);
      expect(win1.subnodes[0].nodeText).not.toBe('Changed');
    });
  });

  describe('IMPORT_RESULT (msg2view_importResult)', () => {
    it('stores successful import result', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => {
        result.current.handleMessage({
          command: 'msg2view_importResult',
          success: true,
          nodeCount: 42,
        } as Msg_ImportResult);
      });

      expect(result.current.state.importResult).toEqual({
        success: true,
        nodeCount: 42,
      });
    });

    it('stores failed import result with error', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => {
        result.current.handleMessage({
          command: 'msg2view_importResult',
          success: false,
          nodeCount: 0,
          error: 'Invalid JSON',
        } as Msg_ImportResult);
      });

      expect(result.current.state.importResult).toEqual({
        success: false,
        nodeCount: 0,
        error: 'Invalid JSON',
      });
    });

    it('clears importResult on re-init', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => {
        result.current.handleMessage({
          command: 'msg2view_importResult',
          success: true,
          nodeCount: 10,
        } as Msg_ImportResult);
      });
      expect(result.current.state.importResult).not.toBeNull();

      act(() => result.current.handleMessage(makeInitMessage()));
      expect(result.current.state.importResult).toBeNull();
    });
  });

  describe('EXPORT_READY / EXPORT_ERROR (msg2view_exportResult)', () => {
    it('stores export JSON on success', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      const json = '{"n":{"data":{}},"s":[]}';
      act(() => {
        result.current.handleMessage({
          command: 'msg2view_exportResult',
          success: true,
          treeJson: json,
        } as Msg_ExportResult);
      });

      expect(result.current.state.exportJson).toBe(json);
      expect(result.current.state.exportError).toBeNull();
    });

    it('stores export error on failure', () => {
      const { result } = renderHook(() => useTreeData());
      act(() => result.current.handleMessage(makeInitMessage()));

      act(() => {
        result.current.handleMessage({
          command: 'msg2view_exportResult',
          success: false,
          error: 'Serialization failed',
        } as Msg_ExportResult);
      });

      expect(result.current.state.exportJson).toBeNull();
      expect(result.current.state.exportError).toBe('Serialization failed');
    });
  });
});
