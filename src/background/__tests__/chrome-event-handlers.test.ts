import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerChromeEventHandlers } from '../chrome-event-handlers';
import { ViewBridge } from '../view-bridge';
import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { resetMvcIdCounter } from '@/tree/mvc-id';
import { NodeTypesEnum } from '@/types/enums';
import type { TabData, WindowData } from '@/types/node-data';
import type { ActiveSession } from '../active-session';

// Mock all Chrome event subscriptions
const mockEventCleanups: Array<() => void> = [];
function mockEventSubscription() {
  const listeners: Array<(...args: unknown[]) => void> = [];
  const subscribe = vi.fn((cb: (...args: unknown[]) => void) => {
    listeners.push(cb);
    const cleanup = vi.fn();
    mockEventCleanups.push(cleanup);
    return cleanup;
  });
  (subscribe as unknown as { _listeners: typeof listeners })._listeners = listeners;
  return subscribe;
}

vi.mock('@/chrome/tabs', () => ({
  onTabCreated: mockEventSubscription(),
  onTabRemoved: mockEventSubscription(),
  onTabUpdated: mockEventSubscription(),
  onTabMoved: mockEventSubscription(),
  onTabAttached: mockEventSubscription(),
  onTabDetached: mockEventSubscription(),
  onTabActivated: mockEventSubscription(),
  onTabReplaced: mockEventSubscription(),
  getTab: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/chrome/windows', () => ({
  onWindowCreated: mockEventSubscription(),
  onWindowRemoved: mockEventSubscription(),
  onWindowFocusChanged: mockEventSubscription(),
}));

import {
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onTabActivated,
} from '@/chrome/tabs';
import { onWindowCreated, onWindowRemoved } from '@/chrome/windows';

function getListeners(mockFn: ReturnType<typeof vi.fn>): Array<(...args: unknown[]) => void> {
  return (mockFn as unknown as { _listeners: Array<(...args: unknown[]) => void> })._listeners;
}

function createMockSession(
  treeModel: TreeModel,
): ActiveSession {
  return {
    treeModel,
    instanceId: 'test-123',
    closeTracker: new CloseTracker(),
    viewBridge: new ViewBridge(),
    scheduleSave: vi.fn(),
    saveNow: vi.fn().mockResolvedValue(undefined),
    getInitMessage: vi.fn(),
    dispose: vi.fn(),
  } as unknown as ActiveSession;
}

function buildTreeWithWindow(): {
  model: TreeModel;
  root: SessionTreeNode;
  win: WindowTreeNode;
  tab: TabTreeNode;
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
  return { model, root, win, tab };
}

beforeEach(() => {
  resetMvcIdCounter();
  mockEventCleanups.length = 0;
  vi.clearAllMocks();
});

describe('registerChromeEventHandlers()', () => {
  it('registers all event listeners and returns cleanup', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);

    const cleanup = registerChromeEventHandlers(session, session.viewBridge);

    expect(onTabCreated).toHaveBeenCalled();
    expect(onTabRemoved).toHaveBeenCalled();
    expect(onTabUpdated).toHaveBeenCalled();
    expect(onTabActivated).toHaveBeenCalled();
    expect(onWindowCreated).toHaveBeenCalled();
    expect(onWindowRemoved).toHaveBeenCalled();

    expect(typeof cleanup).toBe('function');
  });
});

describe('onTabCreated handler', () => {
  it('creates a tab node under the correct window', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onTabCreated as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler({ id: 20, windowId: 1, url: 'https://new.com', title: 'New' });

    const newTab = model.findActiveTab(20);
    expect(newTab).not.toBeNull();
    expect(newTab!.type).toBe(NodeTypesEnum.TAB);
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('ignores tabs with missing windowId', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onTabCreated as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler({ id: 20, url: 'https://new.com', title: 'New' });

    const newTab = model.findActiveTab(20);
    expect(newTab).toBeNull();
  });
});

describe('onTabRemoved handler', () => {
  it('tracks close for undo and removes tab', () => {
    const { model, win } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onTabRemoved as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    expect(win.subnodes.length).toBe(1);
    handler(10, { windowId: 1, isWindowClosing: false });

    // Tab should be removed (no marks, no children)
    expect(model.findActiveTab(10)).toBeNull();
    expect(session.closeTracker.size).toBe(1);
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('converts marked tab to saved instead of removing', () => {
    const { model, tab } = buildTreeWithWindow();
    tab.marks = { relicons: [], customTitle: 'Important' };
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onTabRemoved as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler(10, { windowId: 1, isWindowClosing: false });

    // Should be replaced with saved, not removed entirely
    let savedCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDTAB) savedCount++;
    });
    expect(savedCount).toBe(1);
  });
});

describe('onTabUpdated handler', () => {
  it('updates tab node chrome data', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onTabUpdated as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler(10, { title: 'Updated' }, {
      id: 10,
      windowId: 1,
      url: 'https://updated.com',
      title: 'Updated',
    });

    const tab = model.findActiveTab(10);
    expect(tab).not.toBeNull();
    expect((tab!.data as TabData).title).toBe('Updated');
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('onTabActivated handler', () => {
  it('updates active state on tabs in window', () => {
    const root = new SessionTreeNode();
    const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
    const tab1 = new TabTreeNode({
      id: 10,
      windowId: 1,
      url: 'https://a.com',
      title: 'A',
      active: true,
    });
    const tab2 = new TabTreeNode({
      id: 11,
      windowId: 1,
      url: 'https://b.com',
      title: 'B',
      active: false,
    });
    root.insertSubnode(0, win);
    win.insertSubnode(0, tab1);
    win.insertSubnode(1, tab2);
    const model = new TreeModel(root);
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onTabActivated as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler({ tabId: 11, windowId: 1 });

    expect((model.findActiveTab(10)!.data as TabData).active).toBe(false);
    expect((model.findActiveTab(11)!.data as TabData).active).toBe(true);
  });
});

describe('onWindowCreated handler', () => {
  it('creates a new window node', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onWindowCreated as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler({ id: 5, type: 'normal', focused: false });

    const newWin = model.findActiveWindow(5);
    expect(newWin).not.toBeNull();
    expect(newWin!.type).toBe(NodeTypesEnum.WINDOW);
  });

  it('does not duplicate existing windows', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onWindowCreated as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler({ id: 1, type: 'normal', focused: true });

    let winCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.WINDOW) winCount++;
    });
    expect(winCount).toBe(1);
  });
});

describe('onWindowRemoved handler', () => {
  it('converts window and tabs to saved', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const listeners = getListeners(onWindowRemoved as ReturnType<typeof vi.fn>);
    const handler = listeners[listeners.length - 1];

    handler(1);

    expect(model.findActiveWindow(1)).toBeNull();

    let savedWinCount = 0;
    let savedTabCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDWINDOW) savedWinCount++;
      if (n.type === NodeTypesEnum.SAVEDTAB) savedTabCount++;
    });
    expect(savedWinCount).toBe(1);
    expect(savedTabCount).toBe(1);
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});
