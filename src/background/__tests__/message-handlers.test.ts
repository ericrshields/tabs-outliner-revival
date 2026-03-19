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
import type {
  ViewToBackgroundMessage,
  Msg_InitTreeView,
} from '@/types/messages';

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
  getWindow: vi.fn().mockResolvedValue(null),
  createWindowWithUrl: vi.fn().mockResolvedValue({
    id: 100,
    windowId: 999,
    url: 'https://saved.com',
    title: 'Saved Page',
    active: true,
  }),
}));

import { focusTab, createTab, removeTab } from '@/chrome/tabs';
import {
  focusWindow,
  removeWindow,
  getWindow,
  createWindowWithUrl,
} from '@/chrome/windows';

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
    importTree: vi.fn().mockResolvedValue({
      success: false,
      nodeCount: 0,
      error: 'not configured',
    }),
    exportTree: vi
      .fn()
      .mockReturnValue({ success: false, error: 'not configured' }),
    exportTreeHtml: vi
      .fn()
      .mockReturnValue({ success: false, error: 'not configured' }),
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        // Parent is a live WINDOW (id: 1) so tab opens in that window
        expect(createTab).toHaveBeenCalledWith({
          url: 'https://saved.com',
          windowId: 1,
        });
      });

      // Saved node should be replaced with an active tab
      expect(model.findByMvcId(savedTab.idMVC)).toBeNull();
      const activeTab = win.subnodes[0];
      expect(activeTab.type).toBe(NodeTypesEnum.TAB);
      expect((activeTab.data as TabData).id).toBe(100);
      expect((activeTab as TabTreeNode).restoredFromSaved).toBe(true);
      expect(session.scheduleSave).toHaveBeenCalled();

      // Verify onNodeReplaced broadcast with parent updates
      const broadcasts = (
        viewPort.postMessage as ReturnType<typeof vi.fn>
      ).mock.calls.map((c) => c[0] as Record<string, unknown>);
      const replaceBroadcast = broadcasts.find(
        (m) =>
          m.command === 'msg2view_notifyObserver' &&
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
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
      const broadcasts = (
        viewPort.postMessage as ReturnType<typeof vi.fn>
      ).mock.calls.map((c) => c[0] as Record<string, unknown>);
      const removeBroadcast = broadcasts.find(
        (m) =>
          m.command === 'msg2view_notifyObserver' &&
          Array.isArray(m.parameters) &&
          (m.parameters as string[]).includes('onNodeRemoved'),
      );
      expect(removeBroadcast).toBeDefined();
    });

    it('opens saved tab in its live parent window', async () => {
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 100,
        windowId: 42,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });
      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 42, type: 'normal', focused: true });
      const savedTab = new SavedTabTreeNode({
        url: 'https://saved.com',
        title: 'Saved Page',
      });
      root.insertSubnode(0, win);
      win.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createTab).toHaveBeenCalledWith({
          url: 'https://saved.com',
          windowId: 42,
        });
      });
      expect(createWindowWithUrl).not.toHaveBeenCalled();
    });

    it('creates a new window when saved tab parent window no longer exists', async () => {
      (getWindow as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (createWindowWithUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 100,
        windowId: 999,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });

      const root = new SessionTreeNode();
      const savedWin = new SavedWindowTreeNode({ id: 7, type: 'normal' });
      const savedTab = new SavedTabTreeNode({
        url: 'https://saved.com',
        title: 'Saved Page',
      });
      root.insertSubnode(0, savedWin);
      savedWin.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createWindowWithUrl).toHaveBeenCalledWith('https://saved.com');
        // SAVEDTAB replaced with active TAB under its original SAVEDWINDOW
        expect(savedWin.subnodes[0].type).toBe(NodeTypesEnum.TAB);
      });
      expect(createTab).not.toHaveBeenCalled();
    });

    it('reuses the window from a prior SAVEDTAB restore when siblings are active', async () => {
      // Simulates clicking the second SAVEDTAB from the same SAVEDWINDOW after
      // the first one already opened a new Chrome window (window 999).
      (getWindow as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 101,
        windowId: 999,
        url: 'https://second.com',
        title: 'Second',
        active: true,
      });

      const root = new SessionTreeNode();
      const savedWin = new SavedWindowTreeNode({ id: 7, type: 'normal' });
      // First SAVEDTAB was already restored — now an active TAB in window 999
      const restoredTab = new TabTreeNode({
        id: 50,
        windowId: 999,
        url: 'https://first.com',
        title: 'First',
        active: false,
      });
      const savedTab2 = new SavedTabTreeNode({
        url: 'https://second.com',
        title: 'Second',
      });
      root.insertSubnode(0, savedWin);
      savedWin.insertSubnode(0, restoredTab);
      savedWin.insertSubnode(1, savedTab2);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab2.idMVC,
        },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        // Should reuse window 999 (the sibling TAB's windowId), not create a new one
        expect(createTab).toHaveBeenCalledWith({
          url: 'https://second.com',
          windowId: 999,
        });
      });
      expect(createWindowWithUrl).not.toHaveBeenCalled();
    });

    it('opens saved tab in saved window when that window still exists in Chrome', async () => {
      (getWindow as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 7,
        type: 'normal',
        incognito: false,
      });
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 100,
        windowId: 7,
        url: 'https://saved.com',
        title: 'Saved Page',
        active: true,
      });

      const root = new SessionTreeNode();
      const savedWin = new SavedWindowTreeNode({ id: 7, type: 'normal' });
      const savedTab = new SavedTabTreeNode({
        url: 'https://saved.com',
        title: 'Saved Page',
      });
      root.insertSubnode(0, savedWin);
      savedWin.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createTab).toHaveBeenCalledWith({
          url: 'https://saved.com',
          windowId: 7,
        });
      });
      expect(createWindowWithUrl).not.toHaveBeenCalled();
    });

    it('opens saved tab nested under a live TAB (sub-tree) in the same window', async () => {
      // Simulates a SAVEDTAB that is a child of a live TAB node (sub-tree
      // hierarchy). The immediate parent is a TAB with windowId=55, not a
      // WINDOW node. The ancestor walk should reach the TAB and use its
      // windowId.
      (createTab as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 101,
        windowId: 55,
        url: 'https://child.com',
        title: 'Child Page',
        active: true,
      });

      const root = new SessionTreeNode();
      const win = new WindowTreeNode({ id: 55, type: 'normal', focused: true });
      const parentTab = new TabTreeNode({
        id: 90,
        windowId: 55,
        url: 'https://parent.com',
        title: 'Parent',
        active: false,
      });
      const savedTab = new SavedTabTreeNode({
        url: 'https://child.com',
        title: 'Child Page',
      });
      root.insertSubnode(0, win);
      win.insertSubnode(0, parentTab);
      parentTab.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
        port,
        session,
        session.viewBridge,
      );

      await vi.waitFor(() => {
        expect(createTab).toHaveBeenCalledWith({
          url: 'https://child.com',
          windowId: 55,
        });
      });
      expect(createWindowWithUrl).not.toHaveBeenCalled();
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: savedTab.idMVC,
        },
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
        {
          request: 'request2bkg_invertCollapsedState',
          targetNodeIdMVC: win.idMVC,
        },
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
      const broadcastMsg = (viewPort.postMessage as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(broadcastMsg.command).toBe('msg2view_notifyObserver');
      expect(broadcastMsg.parameters).toContain('onNodeRemoved');
    });

    it('deleteAction removes empty unmarked window parent after last child', () => {
      const root = new SessionTreeNode();
      const savedWin = new SavedWindowTreeNode({ type: 'normal' });
      const savedTab = new SavedTabTreeNode({
        url: 'https://example.com',
        title: 'Example',
      });
      root.insertSubnode(0, savedWin);
      savedWin.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

      const savedWinIdMVC = savedWin.idMVC;

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: savedTab.idMVC,
          actionId: 'deleteAction',
        },
        port,
        session,
        session.viewBridge,
      );

      // Tab removed, then empty window auto-removed
      expect(model.findByMvcId(savedTab.idMVC)).toBeNull();
      expect(model.findByMvcId(savedWinIdMVC)).toBeNull();
      expect(root.subnodes.length).toBe(0);

      // Verify window removal was broadcast
      const broadcasts = (
        viewPort.postMessage as ReturnType<typeof vi.fn>
      ).mock.calls.map((c) => c[0] as Record<string, unknown>);
      const windowRemoved = broadcasts.find(
        (m) =>
          m.command === 'msg2view_notifyObserver' &&
          Array.isArray(m.parameters) &&
          (m.parameters as string[]).includes('onNodeRemoved') &&
          m.idMVC === savedWinIdMVC,
      );
      expect(windowRemoved).toBeDefined();
    });

    it('deleteAction preserves marked empty window parent', () => {
      const root = new SessionTreeNode();
      const savedWin = new SavedWindowTreeNode({ type: 'normal' });
      savedWin.marks = { relicons: [], customTitle: 'Keep Me' };
      const savedTab = new SavedTabTreeNode({
        url: 'https://example.com',
        title: 'Example',
      });
      root.insertSubnode(0, savedWin);
      savedWin.insertSubnode(0, savedTab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();

      handleViewMessage(
        {
          request: 'request2bkg_activateHoveringMenuActionOnNode',
          targetNodeIdMVC: savedTab.idMVC,
          actionId: 'deleteAction',
        },
        port,
        session,
        session.viewBridge,
      );

      // Window should still exist — it has marks
      expect(root.subnodes.length).toBe(1);
      expect(root.subnodes[0]).toBe(savedWin);
    });

    it('handles closeAction on a tab by converting to saved then closing', () => {
      const { model, tab, win } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const viewPort = createMockPort();
      session.viewBridge.addPort(viewPort);

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

      // Tab should be converted to saved before Chrome close
      const child = win.subnodes[0];
      expect(child.type).toBe('savedtab');
      expect((child.data as { active: boolean }).active).toBe(false);

      // Chrome tab should still be closed
      expect(removeTab).toHaveBeenCalledWith(10);

      // View should be notified of the replacement
      expect(viewPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'msg2view_notifyObserver',
          parameters: ['onNodeReplaced'],
        }),
      );
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

      const msg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
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

      const msg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
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

      const msg = (viewPort.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
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

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Rejected unknown action'),
      );
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
      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
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

      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
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
      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(resultMsg.command).toBe('msg2view_exportResult');
      expect(resultMsg.success).toBe(true);
      expect(resultMsg.treeJson).toBeTruthy();
    });

    it('sends HTML export result when format is html', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      (session.exportTreeHtml as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        treeHtml: '<li>Current Session</li>',
      });
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_export_tree', format: 'html' },
        port,
        session,
        session.viewBridge,
      );

      expect(session.exportTreeHtml).toHaveBeenCalled();
      expect(session.exportTree).not.toHaveBeenCalled();
      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(resultMsg.command).toBe('msg2view_exportResult');
      expect(resultMsg.success).toBe(true);
      expect(resultMsg.treeHtml).toBe('<li>Current Session</li>');
    });

    it('sends error result when HTML export fails', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      (session.exportTreeHtml as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        error: 'Serialization failed',
      });
      const port = createMockPort();

      handleViewMessage(
        { request: 'request2bkg_export_tree', format: 'html' },
        port,
        session,
        session.viewBridge,
      );

      const resultMsg = (port.postMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(resultMsg.command).toBe('msg2view_exportResult');
      expect(resultMsg.success).toBe(false);
      expect(resultMsg.error).toBe('Serialization failed');
    });
  });

  describe('request2bkg_moveHierarchy', () => {
    it('wraps a tab in a new SavedWindow when dropped at root', () => {
      const { model, tab, win } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const broadcastSpy = vi.spyOn(session.viewBridge, 'broadcast');
      const tabIdMVC = tab.idMVC;

      // tab is a child of win; drop it at root position 0
      handleViewMessage(
        {
          request: 'request2bkg_moveHierarchy',
          targetNodeIdMVC: tabIdMVC,
          containerIdMVC: null,
          position: 0,
        },
        port,
        session,
        session.viewBridge,
      );

      // A new SavedWindow was inserted at root position 0 and the tab moved inside it
      const wrapper = model.root?.subnodes[0];
      expect(wrapper?.type).toBe(NodeTypesEnum.SAVEDWINDOW);
      expect(wrapper?.subnodes[0].idMVC).toBe(tabIdMVC);
      expect(tab.parent?.idMVC).toBe(wrapper?.idMVC);
      expect(win.subnodes).toHaveLength(0);

      // Broadcast fired with correct idMVC
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'msg2view_notifyObserver',
          idMVC: tabIdMVC,
          parameters: ['onNodeMoved'],
        }),
      );
      expect(session.scheduleSave).toHaveBeenCalled();
    });

    it('moves a node into a named container', () => {
      // Build: root → win1 → tab, root → win2
      const root = new SessionTreeNode();
      const win1 = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
      const win2 = new WindowTreeNode({
        id: 2,
        type: 'normal',
        focused: false,
      });
      const tab = new TabTreeNode({
        id: 10,
        windowId: 1,
        url: 'https://example.com',
        title: 'Example',
        active: true,
      });
      root.insertSubnode(0, win1);
      root.insertSubnode(1, win2);
      win1.insertSubnode(0, tab);
      const model = new TreeModel(root);
      const session = createMockSession(model);
      const port = createMockPort();
      const broadcastSpy = vi.spyOn(session.viewBridge, 'broadcast');

      handleViewMessage(
        {
          request: 'request2bkg_moveHierarchy',
          targetNodeIdMVC: tab.idMVC,
          containerIdMVC: win2.idMVC,
          position: 0,
        },
        port,
        session,
        session.viewBridge,
      );

      expect(tab.parent?.idMVC).toBe(win2.idMVC);
      expect(win1.subnodes).toHaveLength(0);
      expect(win2.subnodes[0].idMVC).toBe(tab.idMVC);
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ parameters: ['onNodeMoved'] }),
      );
      expect(session.scheduleSave).toHaveBeenCalled();
    });

    it('is a no-op when the source node is not found', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const broadcastSpy = vi.spyOn(session.viewBridge, 'broadcast');

      handleViewMessage(
        {
          request: 'request2bkg_moveHierarchy',
          targetNodeIdMVC: 'nonexistent',
          containerIdMVC: null,
          position: 0,
        },
        port,
        session,
        session.viewBridge,
      );

      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(session.scheduleSave).not.toHaveBeenCalled();
    });

    it('is a no-op when the source node has no parent (root guard)', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const broadcastSpy = vi.spyOn(session.viewBridge, 'broadcast');

      handleViewMessage(
        {
          request: 'request2bkg_moveHierarchy',
          targetNodeIdMVC: model.root!.idMVC,
          containerIdMVC: null,
          position: 0,
        },
        port,
        session,
        session.viewBridge,
      );

      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(session.scheduleSave).not.toHaveBeenCalled();
    });

    it('is a no-op (no broadcast, no save) when the container is not found', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const broadcastSpy = vi.spyOn(session.viewBridge, 'broadcast');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleViewMessage(
        {
          request: 'request2bkg_moveHierarchy',
          targetNodeIdMVC: tab.idMVC,
          containerIdMVC: 'nonexistent-container',
          position: 0,
        },
        port,
        session,
        session.viewBridge,
      );

      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(session.scheduleSave).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('moveNode failed'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  describe('deferred handlers', () => {
    it('logs warning for deferred Epic 8 messages', () => {
      const { model } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      handleViewMessage(
        {
          request: 'request2bkg_performDrop',
          targetNodeIdMVC: 'x',
          position: 0,
          dataTransfer: null,
        },
        port,
        session,
        session.viewBridge,
      );

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Epic 8'));
      spy.mockRestore();
    });
  });
});
