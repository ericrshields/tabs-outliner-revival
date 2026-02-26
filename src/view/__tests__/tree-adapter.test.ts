import { describe, it, expect, beforeEach } from 'vitest';
import { nodeId, nodeChildren, buildOpenMap } from '../tree-adapter';
import { makeNodeDTO, makeTree, resetFixtureCounter } from './fixtures';
import type { MvcId } from '@/types/brands';

beforeEach(() => {
  resetFixtureCounter();
});

describe('nodeId', () => {
  it('returns the idMVC string', () => {
    const node = makeNodeDTO({ idMVC: 'test-id' as MvcId });
    expect(nodeId(node)).toBe('test-id');
  });
});

describe('nodeChildren', () => {
  it('returns null for a true leaf node', () => {
    const leaf = makeNodeDTO({
      subnodes: [],
      isSubnodesPresent: false,
    });
    expect(nodeChildren(leaf)).toBeNull();
  });

  it('returns empty array for a collapsed node with hidden children', () => {
    const collapsed = makeNodeDTO({
      colapsed: true,
      subnodes: [],
      isSubnodesPresent: true,
    });
    const result = nodeChildren(collapsed);
    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });

  it('returns subnodes for an expanded node with children', () => {
    const child1 = makeNodeDTO({ idMVC: 'c1' as MvcId });
    const child2 = makeNodeDTO({ idMVC: 'c2' as MvcId });
    const parent = makeNodeDTO({
      subnodes: [child1, child2],
      isSubnodesPresent: true,
    });
    const result = nodeChildren(parent);
    expect(result).toHaveLength(2);
    expect(result![0].idMVC).toBe('c1');
    expect(result![1].idMVC).toBe('c2');
  });

  it('returns subnodes when isSubnodesPresent is false but subnodes exist', () => {
    // Edge case: data inconsistency — prefer the presence of actual subnodes
    const child = makeNodeDTO({ idMVC: 'c1' as MvcId });
    const parent = makeNodeDTO({
      subnodes: [child],
      isSubnodesPresent: false,
    });
    expect(nodeChildren(parent)).toHaveLength(1);
  });
});

describe('buildOpenMap', () => {
  it('returns empty map for a leaf root', () => {
    const root = makeNodeDTO({
      isSubnodesPresent: false,
      subnodes: [],
    });
    expect(buildOpenMap(root)).toEqual({});
  });

  it('marks expanded nodes as open (true)', () => {
    const root = makeTree();
    const map = buildOpenMap(root);
    // root is expanded
    expect(map['root']).toBe(true);
    // win1 is expanded with 2 tabs
    expect(map['win1']).toBe(true);
  });

  it('marks collapsed nodes as closed (false)', () => {
    const root = makeTree();
    const map = buildOpenMap(root);
    // win2 is collapsed
    expect(map['win2']).toBe(false);
  });

  it('omits true leaf nodes from the map', () => {
    const root = makeTree();
    const map = buildOpenMap(root);
    // tab1 is a leaf
    expect(map).not.toHaveProperty('tab1');
    expect(map).not.toHaveProperty('tab2');
    expect(map).not.toHaveProperty('tab3');
  });

  it('includes all internal nodes from a multi-level tree', () => {
    const root = makeTree();
    const map = buildOpenMap(root);
    // root + win1 + win2 + win3 = 4 internal nodes
    expect(Object.keys(map)).toHaveLength(4);
    expect(map).toHaveProperty('root');
    expect(map).toHaveProperty('win1');
    expect(map).toHaveProperty('win2');
    expect(map).toHaveProperty('win3');
  });

  it('handles deeply nested trees', () => {
    const leaf = makeNodeDTO({ idMVC: 'leaf' as MvcId });
    const group = makeNodeDTO({
      idMVC: 'group' as MvcId,
      subnodes: [leaf],
      isSubnodesPresent: true,
      colapsed: true,
    });
    const window = makeNodeDTO({
      idMVC: 'win' as MvcId,
      subnodes: [group],
      isSubnodesPresent: true,
      colapsed: false,
    });
    const root = makeNodeDTO({
      idMVC: 'root' as MvcId,
      subnodes: [window],
      isSubnodesPresent: true,
    });

    const map = buildOpenMap(root);
    expect(map['root']).toBe(true);
    expect(map['win']).toBe(true);
    expect(map['group']).toBe(false);
    expect(map).not.toHaveProperty('leaf');
  });
});
