import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleViewMessage } from '../message-handlers';
import { ViewBridge } from '../view-bridge';
import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { resetMvcIdCounter } from '@/tree/mvc-id';
import type { ActiveSession } from '../active-session';
import type { ViewToBackgroundMessage, Msg_InitTreeView } from '@/types/messages';

vi.mock('@/chrome/tabs', () => ({
  focusTab: vi.fn().mockResolvedValue(undefined),
  removeTab: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/chrome/windows', () => ({
  removeWindow: vi.fn().mockResolvedValue(undefined),
}));

import { focusTab, removeTab } from '@/chrome/tabs';
import { removeWindow } from '@/chrome/windows';

function createMockPort(): Browser.runtime.Port {
  return {
    name: 'tree-view',
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
    },
  } as unknown as Browser.runtime.Port;
}

function createMockSession(model: TreeModel): ActiveSession {
  let nextViewId = 0;
  return {
    treeModel: model,
    instanceId: 'test-456',
    closeTracker: new CloseTracker(),
    viewBridge: new ViewBridge(),
    scheduleSave: vi.fn(),
    saveNow: vi.fn().mockResolvedValue(undefined),
    getInitMessage: vi.fn().mockImplementation(() => {
      nextViewId++;
      return {
        command: 'msg2view_initTreeView',
        rootNode_currentSession: {},
        globalViewId: nextViewId,
        instanceId: 'test-456',
      } as unknown as Msg_InitTreeView;
    }),
    importTree: vi.fn().mockResolvedValue({ success: false, nodeCount: 0, error: 'not configured' }),
    exportTree: vi.fn().mockReturnValue({ success: false, error: 'not configured' }),
    dispose: vi.fn(),
  } as unknown as ActiveSession;
}

function buildModel(): {
  model: TreeModel;
  tab: TabTreeNode;
  win: WindowTreeNode;
} {
  const root = new SessionTreeNode();
  const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
  const tab = new TabTreeNode({
    id: 10,
    windowId: 1,
    url: 'https://example.com',
    title: 'Example',
    active: true,
  });
  root.insertSubnode(0, win);
  win.insertSubnode(0, tab);
  const model = new TreeModel(root);
  return { model, tab, win };
}

beforeEach(() => {
  resetMvcIdCounter();
  vi.restoreAllMocks();
});

describe('handleViewMessage()', () => {
  it('ignores heartbeat messages', () => {
    const { model } = buildModel();
    const session = createMockSession(model);
    const port = createMockPort();

    handleViewMessage(
      { __heartbeat: true } as unknown as ViewToBackgroundMessage,
      port,
      session,
      session.viewBridge,
    );

    expect(port.postMessage).not.toHaveBeenCalled();
  });

  describe('request2bkg_get_tree_structure', () => {
    it('sends init message to requesting port', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_get_tree_structure' },
        port,
        session,
        session.viewBridge,
      );

      expect(session.getInitMessage).toHaveBeenCalled();
      expect(port.postMessage).toHaveBeenCalled();
    });
  });

  describe('request2bkg_activateNode', () => {
    it('focuses the Chrome tab', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: tab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      expect(focusTab).toHaveBeenCalledWith(10, 1);
    });

    it('ignores non-existent nodes', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: 'nonexistent' },
        port,
        session,
        session.viewBridge,
      );

      expect(focusTab).not.toHaveBeenCalled();
    });
  });

  describe('request2bkg_invertCollapsedState', () => {
    it('toggles collapsed state and broadcasts update', () => {
      const { model, win } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      expect(win.colapsed).toBe(false);

      handleViewMessage(
        { request: 'request2bkg_invertCollapsedState', targetNodeIdMVC: win.idMVC },
        port,
        session,
        session.viewBridge,
      );

      expect(win.colapsed).toBe(true);
      expect(viewPort.postMessage).toHaveBeenCalled();
      expect(session.scheduleSave).toHaveBeenCalled();
    });
  });

  describe('request2bkg_activateHoveringMenuActionOnNode', () => {
    it('handles deleteAction by removing subtree and broadcasting', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);
      const tabIdMVC = tab.idMVC;

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: tabIdMVC,
          actionId: 'deleteAction',
        },
        port,
        session,
        session.viewBridge,
      );

      expect(model.findByMvcId(tabIdMVC)).toBeNull();
      expect(session.scheduleSave).toHaveBeenCalled();
      // Verify broadcast
      const broadcastMsg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(broadcastMsg.command).toBe('msg2view_notifyObserver');
      expect(broadcastMsg.parameters).toContain('onNodeRemoved');
    });

    it('handles closeAction on a tab by calling removeTab', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: tab.idMVC,
          actionId: 'closeAction',
        },
        port,
        session,
        session.viewBridge,
      );

      expect(removeTab).toHaveBeenCalledWith(10);
    });

    it('handles closeAction on a window by calling removeWindow', () => {
      const { model, win } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: win.idMVC,
          actionId: 'closeAction',
        },
        port,
        session,
        session.viewBridge,
      );

      expect(removeWindow).toHaveBeenCalledWith(1);
    });

    it('handles setCursorAction by broadcasting cursor message', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: tab.idMVC,
          actionId: 'setCursorAction',
        },
        port,
        session,
        session.viewBridge,
      );

      const msg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(msg.command).toBe('msg2view_setCursorHere');
      expect(msg.targetNodeIdMVC).toBe(tab.idMVC);
      expect(msg.doNotScrollView).toBe(false);
    });

    it('handles editTitleAction on tab by broadcasting edit prompt', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: tab.idMVC,
          actionId: 'editTitleAction',
        },
        port,
        session,
        session.viewBridge,
      );

      const msg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(msg.command).toBe('msg2view_activateNodeTabEditTextPrompt');
      expect(msg.targetNodeIdMVC).toBe(tab.idMVC);
    });

    it('handles editTitleAction on window by broadcasting window edit prompt', () => {
      const { model, win } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: win.idMVC,
          actionId: 'editTitleAction',
        },
        port,
        session,
        session.viewBridge,
      );

      const msg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(msg.command).toBe('msg2view_activateNodeWindowEditTextPrompt');
    });

    it('rejects unknown action IDs', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: tab.idMVC,
          actionId: 'hackerAction',
        },
        port,
        session,
        session.viewBridge,
      );

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Rejected unknown action'));
      // Tab should not be affected
      expect(model.findByMvcId(tab.idMVC)).not.toBeNull();
      spy.mockRestore();
    });
  });

  describe('request2bkg_onViewWindowBeforeUnload_saveNow', () => {
    it('triggers immediate save', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_onViewWindowBeforeUnload_saveNow' },
        port,
        session,
        session.viewBridge,
      );

      expect(session.saveNow).toHaveBeenCalled();
    });
  });

  describe('request2bkg_focusTab', () => {
    it('focuses the specified tab', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_focusTab', tabId: 42, tabWindowId: 3 },
        port,
        session,
        session.viewBridge,
      );

      expect(focusTab).toHaveBeenCalledWith(42, 3);
    });
  });

  describe('request2bkg_import_tree', () => {
    it('imports valid HierarchyJSO and broadcasts init', async () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      (session.importTree as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        nodeCount: 42,
      });
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      const treeJson = JSON.stringify({ n: { data: {} }, s: [] });
      handleViewMessage(
        { request: 'request2bkg_import_tree', treeJson },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(session.importTree).toHaveBeenCalledWith(treeJson);
      });

      // Result sent to requesting port
      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(resultMsg.command).toBe('msg2view_importResult');
      expect(resultMsg.success).toBe(true);
      expect(resultMsg.nodeCount).toBe(42);

      // Init broadcast sent to all views
      expect(session.getInitMessage).toHaveBeenCalled();
      expect(viewPort.postMessage).toHaveBeenCalled();
    });

    it('sends error result on import failure without broadcasting', async () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      (session.importTree as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        nodeCount: 0,
        error: 'Invalid format',
      });
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      handleViewMessage(
        { request: 'request2bkg_import_tree', treeJson: 'garbage' },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalled();
      });

      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(resultMsg.success).toBe(false);
      expect(resultMsg.error).toBe('Invalid format');

      // No init broadcast on failure
      expect(session.getInitMessage).not.toHaveBeenCalled();
    });
  });

  describe('request2bkg_export_tree', () => {
    it('sends export result with tree JSON', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      (session.exportTree as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        treeJson: '{"n":{"data":{}},"s":[]}',
      });
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_export_tree' },
        port,
        session,
        session.viewBridge,
      );

      expect(session.exportTree).toHaveBeenCalled();
      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(resultMsg.command).toBe('msg2view_exportResult');
      expect(resultMsg.success).toBe(true);
      expect(resultMsg.treeJson).toBeTruthy();
    });
  });

  describe('deferred handlers', () => {
    it('logs warning for deferred Epic 8 messages', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      handleViewMessage(
        { request: 'request2bkg_performDrop', targetNodeIdMVC: 'x', position: 0, dataTransfer: null },
        port,
        session,
        session.viewBridge,
      );

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Epic 8'));
      spy.mockRestore();
    });
  });
});
