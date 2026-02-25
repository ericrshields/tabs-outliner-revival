import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateBadge } from '../badge-manager';
import { TreeModel } from '@/tree/tree-model';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { resetMvcIdCounter } from '@/tree/mvc-id';

vi.mock('@/chrome/action', () => ({
  setBadgeText: vi.fn().mockResolvedValue(undefined),
  setBadgeColor: vi.fn().mockResolvedValue(undefined),
  setTooltip: vi.fn().mockResolvedValue(undefined),
}));

import { setBadgeText, setBadgeColor, setTooltip } from '@/chrome/action';

beforeEach(() => {
  resetMvcIdCounter();
  vi.clearAllMocks();
});

describe('updateBadge()', () => {
  it('shows empty badge for empty tree', async () => {
    const model = TreeModel.createEmpty();

    await updateBadge(model);

    expect(setBadgeText).toHaveBeenCalledWith('');
    expect(setBadgeColor).toHaveBeenCalledWith('#4688F1');
    expect(setTooltip).toHaveBeenCalledWith('Tabs Outliner Revival');
  });

  it('shows node count and stats for populated tree', async () => {
    const root = new SessionTreeNode();
    const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
    const tab1 = new TabTreeNode({ id: 10, url: 'https://a.com', title: 'A' });
    const tab2 = new TabTreeNode({ id: 11, url: 'https://b.com', title: 'B' });

    root.insertSubnode(0, win);
    win.insertSubnode(0, tab1);
    win.insertSubnode(1, tab2);

    const model = new TreeModel(root);

    await updateBadge(model);

    expect(setBadgeText).toHaveBeenCalledWith('2');
    expect(setTooltip).toHaveBeenCalledWith(
      'Tabs Outliner Revival\n3 nodes, 1 windows, 2 tabs',
    );
  });

  it('counts multiple windows and tabs', async () => {
    const root = new SessionTreeNode();
    const win1 = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
    const win2 = new WindowTreeNode({ id: 2, type: 'normal', focused: false });
    const tab1 = new TabTreeNode({ id: 10, url: 'https://a.com', title: 'A' });
    const tab2 = new TabTreeNode({ id: 11, url: 'https://b.com', title: 'B' });
    const tab3 = new TabTreeNode({ id: 12, url: 'https://c.com', title: 'C' });

    root.insertSubnode(0, win1);
    root.insertSubnode(1, win2);
    win1.insertSubnode(0, tab1);
    win1.insertSubnode(1, tab2);
    win2.insertSubnode(0, tab3);

    const model = new TreeModel(root);

    await updateBadge(model);

    expect(setBadgeText).toHaveBeenCalledWith('3');
    expect(setTooltip).toHaveBeenCalledWith(
      'Tabs Outliner Revival\n5 nodes, 2 windows, 3 tabs',
    );
  });
});
