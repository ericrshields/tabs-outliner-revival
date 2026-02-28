import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleViewMessage } from '../message-handlers';
import { ViewBridge } from '../view-bridge';
import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { resetMvcIdCounter } from '@/tree/mvc-id';
import { NodeTypesEnum } from '@/types/enums';
import type { TabData } from '@/types/node-data';
import type { ActiveSession } from '../active-session';
import type { ViewToBackgroundMessage, Msg_InitTreeView } from '@/types/messages';

vi.mock('@/chrome/tabs', () => ({
  focusTab: vi.fn().mockResolvedValue(undefined),
  createTab: vi.fn().mockResolvedValue({
    id: 100,
    windowId: 1,
    url: 'https://saved.com',
    title: 'Saved Page',
    active: true,
  }),
  removeTab: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/chrome/windows', () => ({
  focusWindow: vi.fn().mockResolvedValue(undefined),
  removeWindow: vi.fn().mockResolvedValue(undefined),
}));

import { focusTab, createTab, removeTab } from '@/chrome/tabs';
import { focusWindow, removeWindow } from '@/chrome/windows';

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

    it('opens saved tab URL in Chrome and replaces node in tree', async () => {
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 100,
        windowId: 1,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });

      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({
        url: 'https://saved.com',
        title: 'Saved Page',
      });
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedTab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createTab).toHaveBeenCalledWith({ url: 'https://saved.com' });
      });

      // Saved node should be replaced with an active tab
      expect(model.findByMvcId(savedTab.idMVC)).toBeNull();
      const activeTab = win.subnodes[0];
      expect(activeTab.type).toBe(NodeTypesEnum.TAB);
      expect((activeTab.data as TabData).id).toBe(100);
      expect((activeTab as TabTreeNode).restoredFromSaved).toBe(true);
      expect(session.scheduleSave).toHaveBeenCalled();

      // Verify onNodeReplaced broadcast with parent updates
      const broadcasts = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as Record<string, unknown>,
      );
      const replaceBroadcast = broadcasts.find(
        (m) => m.command === 'msg2view_notifyObserver' &&
          Array.isArray(m.parameters) &&
          (m.parameters as string[]).includes('onNodeReplaced'),
      );
      expect(replaceBroadcast).toBeDefined();
      expect(replaceBroadcast!.parentsUpdateData).toBeDefined();
    });

    it('preserves marks when replacing saved tab with active tab', async () => {
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 100,
        windowId: 1,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });

      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({
        url: 'https://saved.com',
        title: 'Saved Page',
      });
      savedTab.marks = { relicons: [], customTitle: 'My Important Tab' };
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedTab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createTab).toHaveBeenCalled();
      });

      const activeTab = win.subnodes[0];
      expect(activeTab.type).toBe(NodeTypesEnum.TAB);
      expect(activeTab.marks.customTitle).toBe('My Important Tab');
    });

    it('removes duplicate node if handleTabCreated already inserted it', async () => {
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 100,
        windowId: 1,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });

      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({
        url: 'https://saved.com',
        title: 'Saved Page',
      });
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      // Simulate what Chrome does: onTabCreated fires and handleTabCreated
      // inserts a duplicate TabTreeNode before createTab resolves.
      const duplicate = new TabTreeNode({
        id: 100,
        windowId: 1,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });
      model.insertAsLastChild(win, duplicate);

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedTab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createTab).toHaveBeenCalled();
      });

      // Duplicate should be removed, saved tab replaced with active tab
      // Window should have exactly 1 child (the replaced active tab)
      expect(win.subnodes.length).toBe(1);
      expect(win.subnodes[0].type).toBe(NodeTypesEnum.TAB);

      // Verify onNodeRemoved was broadcast for the duplicate
      const broadcasts = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as Record<string, unknown>,
      );
      const removeBroadcast = broadcasts.find(
        (m) => m.command === 'msg2view_notifyObserver' &&
          Array.isArray(m.parameters) &&
          (m.parameters as string[]).includes('onNodeRemoved'),
      );
      expect(removeBroadcast).toBeDefined();
    });

    it('does not open saved tab without URL', async () => {
      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({ title: 'No URL' });
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedTab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      // Give async handler a chance to run
      await new Promise((r) => setTimeout(r, 10));

      expect(createTab).not.toHaveBeenCalled();
      // Node should remain unchanged
      expect(win.subnodes[0].type).toBe(NodeTypesEnum.SAVEDTAB);
    });

    it('leaves tree unchanged when createTab throws', async () => {
      (createTab as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Tab creation failed'),
      );
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({
        url: 'https://example.com',
        title: 'Example',
      });
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedTab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalled();
      });

      // Tree should be unchanged — saved tab still present
      expect(win.subnodes[0].type).toBe(NodeTypesEnum.SAVEDTAB);
      expect(session.scheduleSave).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('blocks non-http/https URLs', async () => {
      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({
        url: 'javascript:alert(1)',
        title: 'XSS',
      });
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedTab.idMVC },
        port,
        session,
        session.viewBridge,
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(createTab).not.toHaveBeenCalled();
      expect(win.subnodes[0].type).toBe(NodeTypesEnum.SAVEDTAB);
    });

    it('focuses an active window', async () => {
      const { model, win } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: win.idMVC },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(focusWindow).toHaveBeenCalledWith(1);
      });
    });

    it('does nothing for saved window click', async () => {
      const root = new SessionTreeNode();
      const savedWin = new SavedWindowTreeNode({
        id: 99,
        type: 'normal',
        closeDate: Date.now(),
      });
      root.insertSubnode(0, savedWin);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();
      const savedWinMvcId = savedWin.idMVC;

      handleViewMessage(
        { request: 'request2bkg_activateNode', targetNodeIdMVC: savedWinMvcId },
        port,
        session,
        session.viewBridge,
      );

      // Give async handler a chance to run
      await new Promise((r) => setTimeout(r, 10));

      expect(createTab).not.toHaveBeenCalled();
      expect(focusTab).not.toHaveBeenCalled();
      expect(focusWindow).not.toHaveBeenCalled();
      // Verify tree state is unchanged
      expect(model.findByMvcId(savedWinMvcId)).not.toBeNull();
      expect(session.scheduleSave).not.toHaveBeenCalled();
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
