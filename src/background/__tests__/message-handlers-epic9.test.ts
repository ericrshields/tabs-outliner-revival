/**
 * Tests for Epic 9 message handlers: inline edit, copy/clone, separator cycling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleViewMessage } from '../message-handlers';
import { ViewBridge } from '../view-bridge';
import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { GroupTreeNode } from '@/tree/nodes/group-node';
import { TextNoteTreeNode } from '@/tree/nodes/text-note-node';
import { SeparatorTreeNode } from '@/tree/nodes/separator-node';
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
    instanceId: 'test-epic9',
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
          instanceId: 'test-epic9',
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
    title: 'Example',
    active: false,
  });
  root.insertSubnode(0, win);
  win.insertSubnode(0, tab);
  const model = new TreeModel(root);
  return { model, root, win, tab };
}

beforeEach(() => {
  resetMvcIdCounter();
  vi.restoreAllMocks();
});

// ── Edit title handlers ────────────────────────────────────────────────────────

describe('editTitleAction for GROUP', () => {
  it('broadcasts msg2view_activateNodeWindowEditTextPrompt', () => {
    const { model, win } = buildBaseModel();
    const group = new GroupTreeNode();
    model.insertSubnode(win, 0, group);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_activateHoveringMenuActionOnNode',
        targetNodeIdMVC: group.idMVC,
        actionId: 'editTitleAction',
      },
      port,
      session,
      bridge,
    );

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_activateNodeWindowEditTextPrompt',
        targetNodeIdMVC: group.idMVC,
      }),
    );
  });

  it('pre-fills existing custom title', () => {
    const { model, win } = buildBaseModel();
    const group = new GroupTreeNode();
    model.insertSubnode(win, 0, group);
    model.setMarks(group, { ...group.marks, customTitle: 'My Group' });
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_activateHoveringMenuActionOnNode',
        targetNodeIdMVC: group.idMVC,
        actionId: 'editTitleAction',
      },
      port,
      session,
      bridge,
    );

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ defaultText: 'My Group' }),
    );
  });
});

describe('editTitleAction for TEXTNOTE', () => {
  it('broadcasts msg2view_activateNodeNoteEditTextPrompt with note content', () => {
    const { model, win } = buildBaseModel();
    const note = new TextNoteTreeNode({ note: 'My note' });
    model.insertSubnode(win, 0, note);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_activateHoveringMenuActionOnNode',
        targetNodeIdMVC: note.idMVC,
        actionId: 'editTitleAction',
      },
      port,
      session,
      bridge,
    );

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_activateNodeNoteEditTextPrompt',
        defaultText: 'My note',
      }),
    );
  });
});

describe('editTitleAction for SEPARATOR', () => {
  it('cycles separator style and broadcasts onNodeUpdated (no text prompt)', () => {
    const { model, win } = buildBaseModel();
    const sep = new SeparatorTreeNode({ separatorIndx: 0 });
    model.insertSubnode(win, 0, sep);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_activateHoveringMenuActionOnNode',
        targetNodeIdMVC: sep.idMVC,
        actionId: 'editTitleAction',
      },
      port,
      session,
      bridge,
    );

    expect(sep.data.separatorIndx).toBe(1);
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_notifyObserver_onNodeUpdated',
        idMVC: sep.idMVC,
      }),
    );
    expect(broadcastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.stringContaining('Prompt') }),
    );
  });

  it('wraps style index (2 → 0)', () => {
    const { model, win } = buildBaseModel();
    const sep = new SeparatorTreeNode({ separatorIndx: 2 });
    model.insertSubnode(win, 0, sep);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_activateHoveringMenuActionOnNode',
        targetNodeIdMVC: sep.idMVC,
        actionId: 'editTitleAction',
      },
      port,
      session,
      bridge,
    );

    expect(sep.data.separatorIndx).toBe(0);
  });
});

// ── Text prompt response handlers ─────────────────────────────────────────────

describe('request2bkg_onOkAfterSetNodeTabTextPrompt', () => {
  it('sets customTitle mark and broadcasts onNodeUpdated', () => {
    const { model, win } = buildBaseModel();
    const tab = new TabTreeNode({
      id: 5,
      windowId: 1,
      url: 'https://x.com',
      title: 'X',
      active: true,
    });
    model.insertSubnode(win, 0, tab);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeTabTextPrompt',
        targetNodeIdMVC: tab.idMVC,
        newText: 'Custom Tab Title',
      },
      port,
      session,
      bridge,
    );

    expect(tab.marks.customTitle).toBe('Custom Tab Title');
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_notifyObserver_onNodeUpdated',
        idMVC: tab.idMVC,
      }),
    );
  });

  it('clears customTitle when newText is empty (whitespace)', () => {
    const { model, win } = buildBaseModel();
    const tab = new TabTreeNode({
      id: 5,
      windowId: 1,
      url: 'https://x.com',
      title: 'X',
      active: true,
    });
    model.insertSubnode(win, 0, tab);
    model.setMarks(tab, { ...tab.marks, customTitle: 'Old Title' });
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeTabTextPrompt',
        targetNodeIdMVC: tab.idMVC,
        newText: '   ',
      },
      port,
      session,
      bridge,
    );

    expect(tab.marks.customTitle).toBeUndefined();
  });

  it('schedules a save', () => {
    const { model, tab } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeTabTextPrompt',
        targetNodeIdMVC: tab.idMVC,
        newText: 'New',
      },
      port,
      session,
      bridge,
    );

    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('request2bkg_onOkAfterSetNodeNoteTextPrompt', () => {
  it('updates note text and broadcasts onNodeUpdated', () => {
    const { model, win } = buildBaseModel();
    const note = new TextNoteTreeNode({ note: 'old text' });
    model.insertSubnode(win, 0, note);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeNoteTextPrompt',
        targetNodeIdMVC: note.idMVC,
        newText: 'new text',
      },
      port,
      session,
      bridge,
    );

    expect(note.persistentData.note).toBe('new text');
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_notifyObserver_onNodeUpdated',
      }),
    );
  });

  it('no-ops for non-TEXTNOTE nodes', () => {
    const { model, tab } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeNoteTextPrompt',
        targetNodeIdMVC: tab.idMVC,
        newText: 'ignored',
      },
      port,
      session,
      bridge,
    );

    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});

describe('request2bkg_onOkAfterSetNodeWindowTextPrompt', () => {
  it('sets customTitle on a window and broadcasts update', () => {
    const { model, win } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeWindowTextPrompt',
        targetNodeIdMVC: win.idMVC,
        newText: 'Work',
      },
      port,
      session,
      bridge,
    );

    expect(win.marks.customTitle).toBe('Work');
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'msg2view_notifyObserver_onNodeUpdated',
      }),
    );
  });

  it('sets customTitle on a group', () => {
    const { model, win } = buildBaseModel();
    const group = new GroupTreeNode();
    model.insertSubnode(win, 0, group);
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_onOkAfterSetNodeWindowTextPrompt',
        targetNodeIdMVC: group.idMVC,
        newText: 'Research',
      },
      port,
      session,
      bridge,
    );

    expect(group.marks.customTitle).toBe('Research');
  });
});

// ── copyHierarchy ──────────────────────────────────────────────────────────────

describe('request2bkg_copyHierarchy', () => {
  it('clones source node and inserts at target position', () => {
    const { model, root, win } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    const originalChildCount = root.subnodes.length;

    handleViewMessage(
      {
        request: 'request2bkg_copyHierarchy',
        sourceIdMVC: win.idMVC,
        targetParentIdMVC: null,
        targetPosition: originalChildCount,
      },
      port,
      session,
      bridge,
    );

    // A new window was inserted at root level
    expect(root.subnodes.length).toBe(originalChildCount + 1);
    const clone = root.subnodes[originalChildCount];
    // Clone is a different node (new idMVC)
    expect(clone.idMVC).not.toBe(win.idMVC);
    // Full broadcast sent
    expect(session.getInitMessage).toHaveBeenCalled();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'msg2view_initTreeView' }),
    );
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('clones entire subtree recursively', () => {
    const { model, root, win } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_copyHierarchy',
        sourceIdMVC: win.idMVC,
        targetParentIdMVC: null,
        targetPosition: 1,
      },
      port,
      session,
      bridge,
    );

    const clone = root.subnodes[1];
    // Clone should have child nodes (the cloned tab)
    expect(clone.subnodes.length).toBe(win.subnodes.length);
  });

  it('no-ops when sourceIdMVC not found', () => {
    const { model } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_copyHierarchy',
        sourceIdMVC: 'nonexistent',
        targetParentIdMVC: null,
        targetPosition: 0,
      },
      port,
      session,
      bridge,
    );

    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('no-ops when targetParent not found', () => {
    const { model, win } = buildBaseModel();
    const session = createMockSession(model);
    const bridge = new ViewBridge();
    const broadcastSpy = vi.spyOn(bridge, 'broadcast');
    const port = createMockPort();

    handleViewMessage(
      {
        request: 'request2bkg_copyHierarchy',
        sourceIdMVC: win.idMVC,
        targetParentIdMVC: 'nonexistent',
        targetPosition: 0,
      },
      port,
      session,
      bridge,
    );

    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
