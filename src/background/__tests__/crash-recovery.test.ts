import { describe, it, expect, vi, beforeEach } from 'vitest';
import { synchronizeTreeWithChrome } from '../crash-recovery';
import { TreeModel } from '@/tree/tree-model';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { resetMvcIdCounter } from '@/tree/mvc-id';
import { NodeTypesEnum } from '@/types/enums';

vi.mock('@/chrome/windows', () => ({
  queryWindows: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/chrome/tabs', () => ({
  queryTabs: vi.fn().mockResolvedValue([]),
}));

import { queryWindows } from '@/chrome/windows';
import { queryTabs } from '@/chrome/tabs';

const mockQueryWindows = queryWindows as ReturnType<typeof vi.fn>;
const mockQueryTabs = queryTabs as ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetMvcIdCounter();
  vi.clearAllMocks();
});

function buildTree(
  windows: Array<{ id: number; tabs: Array<{ id: number; url: string }> }>,
): TreeModel {
  const root = new SessionTreeNode();
  for (const win of windows) {
    const winNode = new WindowTreeNode({
      id: win.id,
      type: 'normal',
      focused: false,
    });
    root.insertSubnode(-1, winNode);
    for (const tab of win.tabs) {
      const tabNode = new TabTreeNode({
        id: tab.id,
        url: tab.url,
        title: tab.url,
        windowId: win.id,
      });
      winNode.insertSubnode(-1, tabNode);
    }
  }
  return new TreeModel(root);
}

describe('synchronizeTreeWithChrome()', () => {
  it('returns zeros when tree matches Chrome state', async () => {
    const model = buildTree([
      { id: 1, tabs: [{ id: 10, url: 'https://a.com' }] },
    ]);

    mockQueryWindows.mockResolvedValue([{ id: 1, type: 'normal' }]);
    mockQueryTabs.mockResolvedValue([
      { id: 10, windowId: 1, url: 'https://a.com' },
    ]);

    const result = await synchronizeTreeWithChrome(model);
    expect(result.recoveredCount).toBe(0);
    expect(result.newCount).toBe(0);
  });

  it('converts orphaned windows to saved', async () => {
    const model = buildTree([
      { id: 1, tabs: [{ id: 10, url: 'https://a.com' }] },
      { id: 2, tabs: [{ id: 20, url: 'https://b.com' }] },
    ]);

    // Window 2 is gone
    mockQueryWindows.mockResolvedValue([{ id: 1, type: 'normal' }]);
    mockQueryTabs.mockResolvedValue([
      { id: 10, windowId: 1, url: 'https://a.com' },
    ]);

    const result = await synchronizeTreeWithChrome(model);

    // Window 2 + tab 20 converted to saved
    expect(result.recoveredCount).toBe(2);

    // Verify types changed
    const nodes: Array<{ type: string }> = [];
    model.forEach((n) => nodes.push({ type: n.type }));

    const savedWins = nodes.filter((n) => n.type === NodeTypesEnum.SAVEDWINDOW);
    const savedTabs = nodes.filter((n) => n.type === NodeTypesEnum.SAVEDTAB);
    expect(savedWins.length).toBe(1);
    expect(savedTabs.length).toBe(1);
  });

  it('converts orphaned tabs to saved (window still exists)', async () => {
    const model = buildTree([
      {
        id: 1,
        tabs: [
          { id: 10, url: 'https://a.com' },
          { id: 11, url: 'https://b.com' },
        ],
      },
    ]);

    // Tab 11 is gone, but window 1 still exists
    mockQueryWindows.mockResolvedValue([{ id: 1, type: 'normal' }]);
    mockQueryTabs.mockResolvedValue([
      { id: 10, windowId: 1, url: 'https://a.com' },
    ]);

    const result = await synchronizeTreeWithChrome(model);
    expect(result.recoveredCount).toBe(1);

    // Tab 10 is still active, tab 11 is saved
    let activeCount = 0;
    let savedCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.TAB) activeCount++;
      if (n.type === NodeTypesEnum.SAVEDTAB) savedCount++;
    });
    expect(activeCount).toBe(1);
    expect(savedCount).toBe(1);
  });

  it('creates nodes for new Chrome windows and tabs', async () => {
    const model = buildTree([]);

    mockQueryWindows.mockResolvedValue([{ id: 5, type: 'normal' }]);
    mockQueryTabs.mockResolvedValue([
      { id: 50, windowId: 5, url: 'https://new.com' },
      { id: 51, windowId: 5, url: 'https://new2.com' },
    ]);

    const result = await synchronizeTreeWithChrome(model);

    // 1 window + 2 tabs
    expect(result.newCount).toBe(3);

    let winCount = 0;
    let tabCount = 0;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.WINDOW) winCount++;
      if (n.type === NodeTypesEnum.TAB) tabCount++;
    });
    expect(winCount).toBe(1);
    expect(tabCount).toBe(2);
  });

  it('adds new tabs to existing windows', async () => {
    const model = buildTree([
      { id: 1, tabs: [{ id: 10, url: 'https://a.com' }] },
    ]);

    mockQueryWindows.mockResolvedValue([{ id: 1, type: 'normal' }]);
    mockQueryTabs.mockResolvedValue([
      { id: 10, windowId: 1, url: 'https://a.com' },
      { id: 11, windowId: 1, url: 'https://new.com' },
    ]);

    const result = await synchronizeTreeWithChrome(model);
    expect(result.newCount).toBe(1);

    // Window node should now have 2 tabs
    const winNode = model.findActiveWindow(1);
    expect(winNode).not.toBeNull();
    expect(winNode!.subnodes.length).toBe(2);
  });

  it('sets crashDetectedDate on orphaned windows', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const model = buildTree([
      { id: 1, tabs: [{ id: 10, url: 'https://a.com' }] },
    ]);

    mockQueryWindows.mockResolvedValue([]);
    mockQueryTabs.mockResolvedValue([]);

    await synchronizeTreeWithChrome(model);

    // Find the saved window
    let savedWin: { data: unknown } | null = null;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDWINDOW) savedWin = n;
    });

    expect(savedWin).not.toBeNull();
    expect((savedWin!.data as { crashDetectedDate?: number }).crashDetectedDate).toBe(now);

    vi.useRealTimers();
  });

  it('preserves marks and collapsed state during recovery', async () => {
    const root = new SessionTreeNode();
    const win = new WindowTreeNode({
      id: 1,
      type: 'normal',
      focused: false,
    });
    win.colapsed = true;
    win.marks = { relicons: [], customTitle: 'My Window' };
    root.insertSubnode(0, win);
    const model = new TreeModel(root);

    mockQueryWindows.mockResolvedValue([]);
    mockQueryTabs.mockResolvedValue([]);

    await synchronizeTreeWithChrome(model);

    let savedWin: { colapsed: boolean; marks: unknown } | null = null;
    model.forEach((n) => {
      if (n.type === NodeTypesEnum.SAVEDWINDOW) savedWin = n;
    });

    expect(savedWin).not.toBeNull();
    expect(savedWin!.colapsed).toBe(true);
    expect((savedWin!.marks as { customTitle?: string }).customTitle).toBe(
      'My Window',
    );
  });

  it('handles empty tree with no Chrome state', async () => {
    const model = TreeModel.createEmpty();
    mockQueryWindows.mockResolvedValue([]);
    mockQueryTabs.mockResolvedValue([]);

    const result = await synchronizeTreeWithChrome(model);
    expect(result.recoveredCount).toBe(0);
    expect(result.newCount).toBe(0);
  });

  it('handles mixed recovery and creation', async () => {
    const model = buildTree([
      { id: 1, tabs: [{ id: 10, url: 'https://a.com' }] },
    ]);

    // Window 1 gone, window 5 is new
    mockQueryWindows.mockResolvedValue([{ id: 5, type: 'normal' }]);
    mockQueryTabs.mockResolvedValue([
      { id: 50, windowId: 5, url: 'https://new.com' },
    ]);

    const result = await synchronizeTreeWithChrome(model);
    expect(result.recoveredCount).toBe(2); // window 1 + tab 10
    expect(result.newCount).toBe(2); // window 5 + tab 50
  });
});
