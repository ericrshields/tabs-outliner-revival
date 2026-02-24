import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleViewMessage } from '../message-handlers';
import { ViewBridge } from '../view-bridge';
import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
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

import { focusTab } from '@/chrome/tabs';

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
  vi.clearAllMocks();
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: tab.idMVC,
        },
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
        {
          request: 'request2bkg_activateNode',
          targetNodeIdMVC: 'nonexistent',
        },
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

      // Add a mock port to the bridge to receive broadcasts
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
    it('handles deleteAction by removing subtree', () => {
      const { model, tab } = buildModel();
      const session = createMockSession(model);
      const port = createMockPort();
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
        {
          request: 'request2bkg_focusTab',
          tabId: 42,
          tabWindowId: 3,
        },
        port,
        session,
        session.viewBridge,
      );

      expect(focusTab).toHaveBeenCalledWith(42, 3);
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

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Epic 8'),
      );

      spy.mockRestore();
    });
  });
});
