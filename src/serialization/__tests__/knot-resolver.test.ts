import { describe, it, expect } from 'vitest';
import { resolveKnotsToHierarchy } from '../knot-resolver';
import type { DiffSnapshot } from '../knot-resolver';
import { NODE_TYPE_STR2NUM } from '../../types/enums';
import { countNodes } from '../hierarchy-jso';
import { i2s36 } from '../base36';

// Helper to build entry JSON (EntryWireFormat tuple as JSON string)
function makeEntry(
  type: string,
  data: unknown,
  collapsed = false,
): string {
  const typeNum = NODE_TYPE_STR2NUM[type];
  const code = collapsed ? -typeNum : typeNum;
  return JSON.stringify([code, data]);
}

describe('resolveKnotsToHierarchy', () => {
  it('resolves a root-only snapshot', () => {
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([['a', 'ca']]), // "cdId" — no subnodes
      entries: new Map(),
    };

    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.n.type).toBe('session');
  });

  it('resolves inline subnodes (cdId@dId&dId)', () => {
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@b&c'],     // root with 2 inline subnodes
        ['b', 'cb'],          // child b, no subnodes
        ['c', 'cc'],          // child c, no subnodes
      ]),
      entries: new Map([
        ['cb', makeEntry('savedtab', { url: 'https://b.com' })],
        ['cc', makeEntry('textnote', { note: 'Note C' })],
      ]),
    };

    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.n.type).toBe('session');
    expect(hierarchy.s).toHaveLength(2);
    expect(hierarchy.s![0].n.data).toEqual({ url: 'https://b.com' });
    expect(hierarchy.s![1].n.type).toBe('textnote');
  });

  it('resolves reference knots (cdId#sdId)', () => {
    // 'a' references 'b' for its subnodes structure
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@d&e'],       // root: inline subnodes d, e
        ['d', 'cd#b'],         // d references b for subnodes
        ['b', 'cb@f'],         // b has inline subnode f
        ['f', 'cf'],           // f is a leaf
        ['e', 'ce'],           // e is a leaf
      ]),
      entries: new Map([
        ['cd', makeEntry('savedwin', null)],
        ['cb', makeEntry('savedwin', null)],
        ['cf', makeEntry('savedtab', { url: 'https://f.com' })],
        ['ce', makeEntry('savedtab', { url: 'https://e.com' })],
      ]),
    };

    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.s).toHaveLength(2);
    // d should have the same subnodes as b (reference resolution)
    expect(hierarchy.s![0].s).toHaveLength(1);
    expect(hierarchy.s![0].s![0].n.data).toEqual({ url: 'https://f.com' });
  });

  it('resolves reference knots with delta (cdId#sdId#ops)', () => {
    // 'a' has two children: 'd' and 'e'
    // 'd' references 'b' subnodes plus a delta modification
    // b has subnodes [f, g], delta adds 'h' as new element
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@d&e'],
        ['d', `cd#b#h|*2`], // ref to b + delta: new 'h', then use 2 from base
        ['b', 'cb@f&g'],
        ['f', 'cf'],
        ['g', 'cg'],
        ['h', 'ch'],
        ['e', 'ce'],
      ]),
      entries: new Map([
        ['cd', makeEntry('savedwin', null)],
        ['cb', makeEntry('savedwin', null)],
        ['cf', makeEntry('savedtab', { url: 'f' })],
        ['cg', makeEntry('savedtab', { url: 'g' })],
        ['ch', makeEntry('savedtab', { url: 'h' })],
        ['ce', makeEntry('savedtab', { url: 'e' })],
      ]),
    };

    const hierarchy = resolveKnotsToHierarchy(snapshot);
    const dNode = hierarchy.s![0]; // d
    // d should have subnodes: [h, f, g] (new h, then use 2 from base [f, g])
    expect(dNode.s).toHaveLength(3);
    expect(dNode.s![0].n.data).toEqual({ url: 'h' });
    expect(dNode.s![1].n.data).toEqual({ url: 'f' });
    expect(dNode.s![2].n.data).toEqual({ url: 'g' });
  });

  it('handles cycle detection', () => {
    // a → b → a (cycle)
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@b'],
        ['b', 'cb@a'], // cycle back to a
      ]),
      entries: new Map([
        ['cb', makeEntry('savedtab', { url: 'b' })],
      ]),
    };

    // Should not throw (infinite recursion), should return placeholder
    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.s).toHaveLength(1);
    // The inner 'a' should be a cycle placeholder, not recurse infinitely
    const inner = hierarchy.s![0].s;
    expect(inner).toHaveLength(1);
    expect(inner![0].n.type).toBe('textnote');
  });

  it('handles missing entries gracefully', () => {
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@b'],
        ['b', 'cb'],
      ]),
      entries: new Map(), // No entries at all
    };

    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.s).toHaveLength(1);
    // b should be a placeholder text note
    expect(hierarchy.s![0].n.type).toBe('textnote');
  });

  it('handles empty allKnots map', () => {
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map(),
      entries: new Map(),
    };

    // Should not throw — root gets empty knot content, returns session placeholder
    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.n.type).toBe('session');
    expect(hierarchy.s).toBeUndefined();
  });

  it('detects cycle in knot base-reference chain (getKnotSubnodes cycle)', () => {
    // Knot 'd' references 'e' which references 'd' — cycle in base-reference resolution
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@d'],
        ['d', 'cd#e'],     // d references e for subnodes
        ['e', 'ce#d'],     // e references d — cycle!
      ]),
      entries: new Map([
        ['cd', makeEntry('savedwin', null)],
        ['ce', makeEntry('savedwin', null)],
      ]),
    };

    // Should not throw — cycle guard in getKnotSubnodes breaks the loop
    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(hierarchy.s).toHaveLength(1);
    // d should resolve (cycle just means empty subnodes from the cycled knot)
    expect(hierarchy.s![0].n.type).toBe('savedwin');
  });

  it('counts nodes correctly for a resolved tree', () => {
    const snapshot: DiffSnapshot = {
      rootDid: 'a',
      allKnots: new Map([
        ['a', 'ca@b&c&d'],
        ['b', 'cb'],
        ['c', 'cc@e'],
        ['d', 'cd'],
        ['e', 'ce'],
      ]),
      entries: new Map([
        ['cb', makeEntry('savedtab', { url: 'b' })],
        ['cc', makeEntry('savedwin', null)],
        ['cd', makeEntry('savedtab', { url: 'd' })],
        ['ce', makeEntry('savedtab', { url: 'e' })],
      ]),
    };

    const hierarchy = resolveKnotsToHierarchy(snapshot);
    expect(countNodes(hierarchy)).toBe(5); // a + b + c + d + e
  });
});
