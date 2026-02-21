import { describe, it, expect, beforeEach } from 'vitest';
import { CloseTracker } from '../close-tracker';
import { TabTreeNode } from '../nodes/tab-node';
import { SavedWindowTreeNode } from '../nodes/saved-window-node';
import { resetMvcIdCounter } from '../mvc-id';

function makeTrackedTab(
  tabId: number,
  url: string,
  parent: SavedWindowTreeNode,
  index: number,
): TabTreeNode {
  const tab = new TabTreeNode({ id: tabId, url, title: url, active: true });
  parent.insertSubnode(index, tab);
  return tab;
}

describe('CloseTracker', () => {
  let tracker: CloseTracker;
  let win: SavedWindowTreeNode;

  beforeEach(() => {
    resetMvcIdCounter();
    tracker = new CloseTracker();
    win = new SavedWindowTreeNode({ id: 1 });
  });

  it('starts empty', () => {
    expect(tracker.size).toBe(0);
  });

  it('tracks a closed tab', () => {
    const tab = makeTrackedTab(42, 'https://example.com', win, 0);
    tracker.track(tab);

    expect(tracker.size).toBe(1);
    const record = tracker.findByTabId(42);
    expect(record).not.toBeNull();
    expect(record!.tabData.url).toBe('https://example.com');
    expect(record!.parentMvcId).toBe(win.idMVC);
    expect(record!.siblingIndex).toBe(0);
    expect(record!.timestamp).toBeGreaterThan(0);
  });

  it('findByUrl locates record', () => {
    const tab = makeTrackedTab(42, 'https://example.com', win, 0);
    tracker.track(tab);

    const record = tracker.findByUrl('https://example.com');
    expect(record).not.toBeNull();
    expect(record!.tabData.id).toBe(42);
  });

  it('returns null for unknown tab id', () => {
    expect(tracker.findByTabId(999)).toBeNull();
  });

  it('returns null for unknown url', () => {
    expect(tracker.findByUrl('https://unknown.com')).toBeNull();
  });

  it('returns most recent match for duplicate tab IDs', () => {
    const tab1 = makeTrackedTab(42, 'https://first.com', win, 0);
    tracker.track(tab1);

    // Simulate re-closing with same tab ID but different URL
    const tab2 = makeTrackedTab(42, 'https://second.com', win, 0);
    tracker.track(tab2);

    const record = tracker.findByTabId(42);
    expect(record!.tabData.url).toBe('https://second.com');
  });

  it('respects maxEntries limit', () => {
    const smallTracker = new CloseTracker(3);

    for (let i = 0; i < 5; i++) {
      const tab = makeTrackedTab(i, `https://site${i}.com`, win, i);
      smallTracker.track(tab);
    }

    expect(smallTracker.size).toBe(3);
    // Oldest entries (0, 1) should be evicted
    expect(smallTracker.findByTabId(0)).toBeNull();
    expect(smallTracker.findByTabId(1)).toBeNull();
    // Newest entries (2, 3, 4) should remain
    expect(smallTracker.findByTabId(2)).not.toBeNull();
    expect(smallTracker.findByTabId(4)).not.toBeNull();
  });

  it('clear removes all records', () => {
    const tab = makeTrackedTab(42, 'https://example.com', win, 0);
    tracker.track(tab);
    expect(tracker.size).toBe(1);

    tracker.clear();
    expect(tracker.size).toBe(0);
    expect(tracker.findByTabId(42)).toBeNull();
  });

  it('does nothing when node has no parent', () => {
    const orphan = new TabTreeNode({ id: 99, url: 'test' });
    tracker.track(orphan);
    expect(tracker.size).toBe(0);
  });

  it('records correct sibling index', () => {
    const tab0 = makeTrackedTab(10, 'https://a.com', win, 0);
    const tab1 = makeTrackedTab(11, 'https://b.com', win, 1);
    const tab2 = makeTrackedTab(12, 'https://c.com', win, 2);

    tracker.track(tab1); // middle tab, index 1

    const record = tracker.findByTabId(11);
    expect(record!.siblingIndex).toBe(1);
  });
});
