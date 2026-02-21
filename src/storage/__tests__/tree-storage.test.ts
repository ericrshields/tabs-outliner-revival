import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { loadTree, saveTree, treeExists } from '../tree-storage';
import type { HierarchyJSO } from '@/types/serialized';

beforeEach(() => {
  fakeBrowser.reset();
});

const sampleTree: HierarchyJSO = {
  n: { type: 'session', data: { treeId: 'test', nextDId: 100 } },
  s: [
    {
      n: { type: 'savedwin', data: null },
      s: [
        { n: { data: { url: 'https://a.com', title: 'A' } } },
        { n: { data: { url: 'https://b.com', title: 'B' } } },
      ],
    },
  ],
};

describe('saveTree / loadTree', () => {
  it('round-trips a tree through storage', async () => {
    await saveTree(sampleTree);
    const loaded = await loadTree();

    expect(loaded).not.toBeNull();
    expect(loaded!.n.type).toBe('session');
    expect(loaded!.s).toHaveLength(1);
    expect(loaded!.s![0].s).toHaveLength(2);
  });

  it('returns null when no tree is stored', async () => {
    const loaded = await loadTree();
    expect(loaded).toBeNull();
  });
});

describe('treeExists', () => {
  it('returns false when no tree is stored', async () => {
    expect(await treeExists()).toBe(false);
  });

  it('returns true after saving a tree', async () => {
    await saveTree(sampleTree);
    expect(await treeExists()).toBe(true);
  });
});
