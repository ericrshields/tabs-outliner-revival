import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  createTab: vi.fn().mockResolvedValue(undefined),
  focusTab: vi.fn().mockResolvedValue(undefined),
  removeTab: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/chrome/windows', () => ({
  onWindowCreated: mockEventSubscription(),
  onWindowRemoved: mockEventSubscription(),
  onWindowFocusChanged: mockEventSubscription(),
  focusWindow: vi.fn().mockResolvedValue(undefined),
  removeWindow: vi.fn().mockResolvedValue(undefined),
}));



import {
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onTabMoved,
  onTabAttached,
  onTabActivated,
  onTabReplaced,
  getTab,
} from '@/chrome/tabs';
import {
  onWindowCreated,
  onWindowRemoved,
  onWindowFocusChanged,
} from '@/chrome/windows';

function getListeners(mockFn: ReturnType<typeof vi.fn>): Array<(...args: unknown[]) => void> {
  return (mockFn as unknown as { _listeners: Array<(...args: unknown[]) => void> })._listeners;
}

function getLastListener(mockFn: ReturnType<typeof vi.fn>): (...args: unknown[]) => void {
  const listeners = getListeners(mockFn);
  return listeners[listeners.length - 1];
}

function createMockSession(treeModel: TreeModel): ActiveSession {
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

function buildTreeWithTwoWindows(): {
  model: TreeModel;
  win1: WindowTreeNode;
  win2: WindowTreeNode;
  tab1: TabTreeNode;
  tab2: TabTreeNode;
} {
  const root = new SessionTreeNode();
  const win1 = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
  const win2 = new WindowTreeNode({ id: 2, type: 'normal', focused: false });
  const tab1 = new TabTreeNode({ id: 10, windowId: 1, url: 'https://a.com', title: 'A', active: true });
  const tab2 = new TabTreeNode({ id: 20, windowId: 2, url: 'https://b.com', title: 'B', active: true });
  root.insertSubnode(0, win1);
  root.insertSubnode(1, win2);
  win1.insertSubnode(0, tab1);
  win2.insertSubnode(0, tab2);
  const model = new TreeModel(root);
  return { model, win1, win2, tab1, tab2 };
}

beforeEach(() => {
  resetMvcIdCounter();
  mockEventCleanups.length = 0;
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('registerChromeEventHandlers()', () => {
  it('registers all event listeners and returns cleanup', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);

    const cleanup = registerChromeEventHandlers(session, session.viewBridge);

    expect(onTabCreated).toHaveBeenCalled();
    expect(onTabRemoved).toHaveBeenCalled();
    expect(onTabUpdated).toHaveBeenCalled();
    expect(onTabMoved).toHaveBeenCalled();
    expect(onTabAttached).toHaveBeenCalled();
    expect(onTabActivated).toHaveBeenCalled();
    expect(onTabReplaced).toHaveBeenCalled();
    expect(onWindowCreated).toHaveBeenCalled();
    expect(onWindowRemoved).toHaveBeenCalled();
    expect(onWindowFocusChanged).toHaveBeenCalled();

    expect(typeof cleanup).toBe('function');
  });
});

describe('onTabCreated handler', () => {
  it('creates a tab node under the correct window', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabCreated as ReturnType<typeof vi.fn>)(
      { id: 20, windowId: 1, url: 'https://new.com', title: 'New' },
    );

    const newTab = model.findActiveTab(20);
    expect(newTab).not.toBeNull();
    expect(newTab!.type).toBe(NodeTypesEnum.TAB);
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('ignores tabs with missing windowId', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabCreated as ReturnType<typeof vi.fn>)(
      { id: 20, url: 'https://new.com', title: 'New' },
    );

    expect(model.findActiveTab(20)).toBeNull();
  });

  it('inserts tab even if URL matches an existing saved tab (dedup is handled by message-handlers)', () => {
    const { model, win } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    // onTabCreated always inserts — handleActivateNode cleans up duplicates
    getLastListener(onTabCreated as ReturnType<typeof vi.fn>)(
      { id: 50, windowId: 1, url: 'https://new.com', title: 'New' },
    );

    expect(model.findActiveTab(50)).not.toBeNull();
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('onTabRemoved handler', () => {
  it('tracks close for undo and removes unmarked tab', () => {
    const { model, win } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    expect(win.subnodes.length).toBe(1);
    getLastListener(onTabRemoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, isWindowClosing: false },
    );

    expect(model.findActiveTab(10)).toBeNull();
    expect(session.closeTracker.size).toBe(1);
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('converts marked tab to saved instead of removing', () => {
    const { model, tab } = buildTreeWithWindow();
    tab.marks = { relicons: [], customTitle: 'Important' };
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabRemoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, isWindowClosing: false },
    );

    let savedCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDTAB) savedCount++;
    });
    expect(savedCount).toBe(1);
  });

  it('converts restoredFromSaved tab to saved instead of removing', () => {
    const { model, tab } = buildTreeWithWindow();
    tab.restoredFromSaved = true;
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabRemoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, isWindowClosing: false },
    );

    let savedCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDTAB) savedCount++;
    });
    expect(savedCount).toBe(1);
  });

  it('does not remove tab when window is closing (defers to window handler)', () => {
    const { model, win } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabRemoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, isWindowClosing: true },
    );

    // Tab should still be in the tree — window handler owns conversion
    expect(win.subnodes.length).toBe(1);
    // But close should still be tracked for undo
    expect(session.closeTracker.size).toBe(1);
  });

  it('broadcasts onNodeRemoved only for actual removals, not replacements', () => {
    const { model, tab } = buildTreeWithWindow();
    tab.marks = { relicons: [], customTitle: 'Keep' };
    const session = createMockSession(model);
    const mockPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn(), hasListeners: vi.fn() },
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn(), hasListeners: vi.fn() },
      name: 'tree-view',
    } as unknown as Browser.runtime.Port;
    session.viewBridge.addPort(mockPort);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabRemoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, isWindowClosing: false },
    );

    // Should NOT have broadcast onNodeRemoved (it was replaced, not removed)
    const messages = (mockPort.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { parameters?: unknown[] }).parameters,
    );
    const hasRemoved = messages.some(
      (p) => Array.isArray(p) && p.includes('onNodeRemoved'),
    );
    expect(hasRemoved).toBe(false);
  });
});

describe('onTabUpdated handler', () => {
  it('updates tab node chrome data', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabUpdated as ReturnType<typeof vi.fn>)(
      10, { title: 'Updated' },
      { id: 10, windowId: 1, url: 'https://updated.com', title: 'Updated' },
    );

    const tab = model.findActiveTab(10);
    expect(tab).not.toBeNull();
    expect((tab!.data as TabData).title).toBe('Updated');
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('onTabMoved handler', () => {
  it('reorders tab within its window', () => {
    const root = new SessionTreeNode();
    const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
    const tab1 = new TabTreeNode({ id: 10, windowId: 1, url: 'https://a.com', title: 'A', active: true });
    const tab2 = new TabTreeNode({ id: 11, windowId: 1, url: 'https://b.com', title: 'B', active: false });
    root.insertSubnode(0, win);
    win.insertSubnode(0, tab1);
    win.insertSubnode(1, tab2);
    const model = new TreeModel(root);
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    // Move tab1 from index 0 to index 1
    getLastListener(onTabMoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, fromIndex: 0, toIndex: 1 },
    );

    expect(win.subnodes[0].type).toBe(NodeTypesEnum.TAB);
    expect((win.subnodes[0].data as TabData).id).toBe(11);
    expect((win.subnodes[1].data as TabData).id).toBe(10);
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('onTabAttached handler', () => {
  it('moves tab to a different window', () => {
    const { model, win1, win2 } = buildTreeWithTwoWindows();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    // Move tab 10 from window 1 to window 2
    getLastListener(onTabAttached as ReturnType<typeof vi.fn>)(
      10, { newWindowId: 2, newPosition: 1 },
    );

    expect(win1.subnodes.length).toBe(0);
    expect(win2.subnodes.length).toBe(2);
    expect((win2.subnodes[1].data as TabData).id).toBe(10);
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('onTabActivated handler', () => {
  it('updates active state on tabs in window', () => {
    const root = new SessionTreeNode();
    const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
    const tab1 = new TabTreeNode({ id: 10, windowId: 1, url: 'https://a.com', title: 'A', active: true });
    const tab2 = new TabTreeNode({ id: 11, windowId: 1, url: 'https://b.com', title: 'B', active: false });
    root.insertSubnode(0, win);
    win.insertSubnode(0, tab1);
    win.insertSubnode(1, tab2);
    const model = new TreeModel(root);
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onTabActivated as ReturnType<typeof vi.fn>)(
      { tabId: 11, windowId: 1 },
    );

    expect((model.findActiveTab(10)!.data as TabData).active).toBe(false);
    expect((model.findActiveTab(11)!.data as TabData).active).toBe(true);
    expect(session.scheduleSave).toHaveBeenCalled();
  });
});

describe('onTabReplaced handler', () => {
  it('updates tab with new Chrome ID and re-indexes', async () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);

    // Mock getTab to return new tab data
    (getTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 99,
      windowId: 1,
      url: 'https://replaced.com',
      title: 'Replaced',
    });

    registerChromeEventHandlers(session, session.viewBridge);

    const handler = getLastListener(onTabReplaced as ReturnType<typeof vi.fn>);
    await handler(99, 10);

    // Old ID gone, new ID indexed
    expect(model.findActiveTab(10)).toBeNull();
    expect(model.findActiveTab(99)).not.toBeNull();
    expect((model.findActiveTab(99)!.data as TabData).url).toBe('https://replaced.com');
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('does nothing when getTab returns null', async () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    (getTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    registerChromeEventHandlers(session, session.viewBridge);

    await getLastListener(onTabReplaced as ReturnType<typeof vi.fn>)(99, 10);

    // Original tab should still exist
    expect(model.findActiveTab(10)).not.toBeNull();
  });
});

describe('onWindowCreated handler', () => {
  it('creates a new window node', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onWindowCreated as ReturnType<typeof vi.fn>)(
      { id: 5, type: 'normal', focused: false },
    );

    const newWin = model.findActiveWindow(5);
    expect(newWin).not.toBeNull();
    expect(newWin!.type).toBe(NodeTypesEnum.WINDOW);
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('does not duplicate existing windows', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    getLastListener(onWindowCreated as ReturnType<typeof vi.fn>)(
      { id: 1, type: 'normal', focused: true },
    );

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

    getLastListener(onWindowRemoved as ReturnType<typeof vi.fn>)(1);

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

  it('preserves all tabs when onTabRemoved fires with isWindowClosing first', () => {
    const { model } = buildTreeWithWindow();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    // Chrome fires onTabRemoved with isWindowClosing=true before onWindowRemoved
    getLastListener(onTabRemoved as ReturnType<typeof vi.fn>)(
      10, { windowId: 1, isWindowClosing: true },
    );
    getLastListener(onWindowRemoved as ReturnType<typeof vi.fn>)(1);

    // Saved window should still have the saved tab as a child
    let savedTabCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDTAB) savedTabCount++;
    });
    expect(savedTabCount).toBe(1);
  });
});

describe('onWindowFocusChanged handler', () => {
  it('updates focused state on all windows', () => {
    const { model, win1, win2 } = buildTreeWithTwoWindows();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    // Focus window 2 (debounced)
    getLastListener(onWindowFocusChanged as ReturnType<typeof vi.fn>)(2);
    vi.advanceTimersByTime(100);

    expect((win1.data as WindowData).focused).toBe(false);
    expect((win2.data as WindowData).focused).toBe(true);
    expect(session.scheduleSave).toHaveBeenCalled();
  });

  it('debounces rapid focus changes', () => {
    const { model } = buildTreeWithTwoWindows();
    const session = createMockSession(model);
    registerChromeEventHandlers(session, session.viewBridge);

    const handler = getLastListener(onWindowFocusChanged as ReturnType<typeof vi.fn>);

    // Rapid focus changes — only last should apply
    handler(2);
    handler(1);
    handler(2);

    vi.advanceTimersByTime(100);

    // scheduleSave should only be called once (for the final debounced call)
    expect(session.scheduleSave).toHaveBeenCalledTimes(1);
  });
});
