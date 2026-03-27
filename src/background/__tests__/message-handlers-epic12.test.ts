/**
 * Tests for Epic 12 message handlers: createWindow, createGroup, createSeparator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleViewMessage } from '../message-handlers';
import { ViewBridge } from '../view-bridge';
import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { GroupTreeNode } from '@/tree/nodes/group-node';
import { SeparatorTreeNode } from '@/tree/nodes/separator-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { resetMvcIdCounter } from '@/tree/mvc-id';
import type { ActiveSession } from '../active-session';
import type { Msg_InitTreeView } from '@/types/messages';

vi.mock('@/chrome/tabs', () => ({
  focusTab: vi.fn(),
  createTab: vi.fn(),
  removeTab: vi.fn(),
}));
vi.mock('@/chrome/windows', () => ({
  focusWindow: vi.fn(),
  removeWindow: vi.fn(),
  getWindow: vi.fn(),
  createWindowWithUrl: vi.fn(),
}));

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
    instanceId: 'test-epic12',
    closeTracker: new CloseTracker(),
    viewBridge: new ViewBridge(),
    scheduleSave: vi.fn(),
    saveNow: vi.fn().mockResolvedValue(undefined),
    getInitMessage: vi.fn().mockImplementation(
      () =>
        ({
          command: 'msg2view_initTreeView',
          rootNode_currentSession: {},
          globalViewId: ++nextViewId,
          instanceId: 'test-epic12',
        }) as unknown as Msg_InitTreeView,
    ),
    importTree: vi.fn(),
    exportTree: vi.fn(),
    exportTreeHtml: vi.fn(),
    dispose: vi.fn(),
  } as unknown as ActiveSession;
}

function buildBaseModel() {
  const root = new SessionTreeNode();
  const win = new SavedWindowTreeNode();
  const tab = new SavedTabTreeNode({
    id: undefined,
    windowId: undefined,
    url: 'https://example.com',
    title: 'Tab 1',
    active: false,
  });
  root.insertSubnode(0, win);
  win.insertSubnode(0, tab);
  const model = new TreeModel(root);
  return { model, root, win, tab };
}

beforeEach(() => {
  resetMvcIdCounter(1);
  vi.restoreAllMocks();
});

// ── createWindow ──────────────────────────────────────────────────────────────

describe('createWindow handler', () => {
  it('inserts a SavedWindowTreeNode after the cursor node when afterIdMVC is set', () => {
    const { model, win } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createWindow', afterIdMVC: win.idMVC },
      port,
      session,
      bridge,
    );

    const root = model.root!;
    expect(root.subnodes).toHaveLength(2);
    expect(root.subnodes[1]).toBeInstanceOf(SavedWindowTreeNode);
  });

  it('appends at root when afterIdMVC is null', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createWindow', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    expect(model.root!.subnodes).toHaveLength(2);
    expect(model.root!.subnodes[1]).toBeInstanceOf(SavedWindowTreeNode);
  });

  it('appends at root when afterIdMVC points to a non-existent node', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createWindow', afterIdMVC: 'nonexistent-id' },
      port,
      session,
      bridge,
    );

    expect(model.root!.subnodes).toHaveLength(2);
    expect(model.root!.subnodes[1]).toBeInstanceOf(SavedWindowTreeNode);
  });

  it('broadcasts onNodeUpdated for the new node', () => {
    const { model, win } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    vi.spyOn(bridge, 'broadcast');
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createWindow', afterIdMVC: win.idMVC },
      port,
      session,
      bridge,
    );

    expect(bridge.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_notifyObserver_onNodeUpdated',
      }),
    );
  });

  it('broadcasts setCursorHere pointing to the new node', () => {
    const { model, win } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    vi.spyOn(bridge, 'broadcast');
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createWindow', afterIdMVC: win.idMVC },
      port,
      session,
      bridge,
    );

    const newNode = model.root!.subnodes[1];
    expect(bridge.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: newNode.idMVC,
        doNotScrollView: false,
      }),
    );
  });

  it('calls scheduleSave', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createWindow', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

// ── createGroup ───────────────────────────────────────────────────────────────

describe('createGroup handler', () => {
  it('inserts a GroupTreeNode after the cursor node (inside same parent)', () => {
    const { model, tab } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createGroup', afterIdMVC: tab.idMVC },
      port,
      session,
      bridge,
    );

    const win = model.root!.subnodes[0];
    expect(win.subnodes).toHaveLength(2);
    expect(win.subnodes[1]).toBeInstanceOf(GroupTreeNode);
  });

  it('appends at root when afterIdMVC is null', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createGroup', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    expect(model.root!.subnodes[1]).toBeInstanceOf(GroupTreeNode);
  });

  it('broadcasts setCursorHere for the new node', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    vi.spyOn(bridge, 'broadcast');
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createGroup', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    const newNode = model.root!.subnodes[1];
    expect(bridge.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: newNode.idMVC,
      }),
    );
  });

  it('calls scheduleSave', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createGroup', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

// ── createSeparator ───────────────────────────────────────────────────────────

describe('createSeparator handler', () => {
  it('inserts a SeparatorTreeNode after the cursor node', () => {
    const { model, tab } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createSeparator', afterIdMVC: tab.idMVC },
      port,
      session,
      bridge,
    );

    const win = model.root!.subnodes[0];
    expect(win.subnodes).toHaveLength(2);
    expect(win.subnodes[1]).toBeInstanceOf(SeparatorTreeNode);
  });

  it('appends at root when afterIdMVC is null', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createSeparator', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    expect(model.root!.subnodes[1]).toBeInstanceOf(SeparatorTreeNode);
  });

  it('appends at root when afterIdMVC points to a non-existent node', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createSeparator', afterIdMVC: 'does-not-exist' },
      port,
      session,
      bridge,
    );

    expect(model.root!.subnodes[1]).toBeInstanceOf(SeparatorTreeNode);
  });

  it('broadcasts setCursorHere for the new node', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    vi.spyOn(bridge, 'broadcast');
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createSeparator', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    const newNode = model.root!.subnodes[1];
    expect(bridge.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: newNode.idMVC,
      }),
    );
  });

  it('calls scheduleSave', () => {
    const { model } = buildBaseModel();
    const port = createMockPort();
    const bridge = new ViewBridge();
    bridge.addPort(port);
    const session = createMockSession(model);

    handleViewMessage(
      { request: 'request2bkg_createSeparator', afterIdMVC: null },
      port,
      session,
      bridge,
    );

    expect(session.scheduleSave).toHaveBeenCalled();
  });
});
