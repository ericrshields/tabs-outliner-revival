import { describe, it, expect } from 'vitest';
import {
  isChangesToBase,
  serializeCurSubnodes,
  restoreSubnodesList,
  getBaseSubnodesArray,
} from '../knot-codec';
import { i2s36 } from '../base36';
import { CDID_SUBNODESLIST_SEPARATOR, SUBNODES_DIDS_SEPARATOR } from '../constants';

describe('isChangesToBase', () => {
  it('returns false for identical arrays', () => {
    expect(isChangesToBase(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(false);
  });

  it('returns true for different lengths', () => {
    expect(isChangesToBase(['a', 'b'], ['a', 'b', 'c'])).toBe(true);
  });

  it('returns true for same length but different elements', () => {
    expect(isChangesToBase(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(true);
  });

  it('returns false for empty arrays', () => {
    expect(isChangesToBase([], [])).toBe(false);
  });
});

describe('getBaseSubnodesArray', () => {
  it('extracts DIDs from knot string', () => {
    expect(getBaseSubnodesArray('ffff@abc&def&ghi')).toEqual([
      'abc',
      'def',
      'ghi',
    ]);
  });

  it('handles single DID', () => {
    expect(getBaseSubnodesArray('ffff@abc')).toEqual(['abc']);
  });

  it('returns empty array for malformed input without @', () => {
    expect(getBaseSubnodesArray('ffff')).toEqual([]);
    expect(getBaseSubnodesArray('')).toEqual([]);
  });
});

describe('serializeCurSubnodes / restoreSubnodesList', () => {
  it('handles no changes (all consecutive)', () => {
    const base = ['a', 'b', 'c'];
    const current = ['a', 'b', 'c'];
    const delta = serializeCurSubnodes(current, base);
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('handles insertion at beginning', () => {
    const base = ['a', 'b', 'c'];
    const current = ['new', 'a', 'b', 'c'];
    const delta = serializeCurSubnodes(current, base);
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('handles insertion at end', () => {
    const base = ['a', 'b', 'c'];
    const current = ['a', 'b', 'c', 'new'];
    const delta = serializeCurSubnodes(current, base);
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('handles deletion from middle', () => {
    const base = ['a', 'b', 'c', 'd'];
    const current = ['a', 'c', 'd'];
    const delta = serializeCurSubnodes(current, base);
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('handles replacement', () => {
    const base = ['a', 'b', 'c'];
    const current = ['a', 'new', 'c'];
    const delta = serializeCurSubnodes(current, base);
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('handles complete replacement', () => {
    const base = ['a', 'b', 'c'];
    const current = ['x', 'y', 'z'];
    const delta = serializeCurSubnodes(current, base);
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('handles empty current', () => {
    const base = ['a', 'b', 'c'];
    const current: string[] = [];
    const delta = serializeCurSubnodes(current, base);
    expect(delta).toBe('');
    expect(restoreSubnodesList(base, delta)).toEqual(current);
  });

  it('bounds-checks oversized *N against base length', () => {
    // Restore with a delta that asks for more elements than base has
    const base = ['a', 'b'];
    const result = restoreSubnodesList(base, '*5');
    // Should stop at base length, not push undefined
    expect(result).toEqual(['a', 'b']);
    expect(result.every((el) => typeof el === 'string')).toBe(true);
  });

  it('bounds-checks oversized -N skip against base length', () => {
    const base = ['a', 'b'];
    // Skip 10, then use next — but base only has 2 elements
    const result = restoreSubnodesList(base, '-a');  // 'a' in base-36 = 10
    expect(result).toEqual([]);
    expect(result.every((el) => typeof el === 'string')).toBe(true);
  });

  /**
   * Fuzz test ported from legacy testSubnodesChangesAlgorithm() (treemodel.js:289-366).
   * Performs 100+ random operations (inserts, deletes) on arrays, verifying
   * that restoreSubnodesList(base, serializeCurSubnodes(current, base))
   * recovers the exact current state.
   */
  it('fuzz test: random insertions and deletions round-trip correctly', () => {
    let did = 10000;
    const subnodes: string[] = [];

    // Initialize with 400 elements
    for (let i = 0; i < 400; i++) subnodes.push(i2s36(did++));

    const subnodesOld = subnodes.slice(0);
    const sdidKnot =
      'ffff' +
      CDID_SUBNODESLIST_SEPARATOR +
      subnodesOld.join(SUBNODES_DIDS_SEPARATOR);

    function ins(i: number) {
      subnodes.splice(i, 0, i2s36(did++));
    }

    function del(i: number) {
      subnodes.splice(i, 1);
    }

    function replace(i: number) {
      del(i);
      ins(i);
    }

    function getRandomInt(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Perform 100 random operations
    for (let i = 0; i <= 100; i++) {
      const op = Math.random();
      const insI = getRandomInt(0, subnodes.length);
      const delI = getRandomInt(0, subnodes.length - 1);

      if (op < 0.2) ins(subnodes.length);
      else if (op < 0.3) replace(subnodes.length - 1);
      else if (op < 0.6) replace(delI);
      else if (op < 0.69) ins(insI);
      else del(delI);
    }

    const subnodesNew = subnodes.slice(0);
    const baseArray = getBaseSubnodesArray(sdidKnot);

    const serializedDifference = serializeCurSubnodes(subnodesNew, baseArray);
    const restoredSubnodes = restoreSubnodesList(subnodesOld, serializedDifference);

    expect(restoredSubnodes).toEqual(subnodesNew);
  });

  it('fuzz test: multiple rounds of random operations', () => {
    // Run the fuzz test multiple times with different random seeds
    for (let round = 0; round < 5; round++) {
      let did = 10000 + round * 10000;
      const subnodes: string[] = [];

      for (let i = 0; i < 200; i++) subnodes.push(i2s36(did++));

      const subnodesOld = subnodes.slice(0);
      const sdidKnot =
        'ffff' +
        CDID_SUBNODESLIST_SEPARATOR +
        subnodesOld.join(SUBNODES_DIDS_SEPARATOR);

      for (let i = 0; i < 50; i++) {
        const op = Math.random();
        if (op < 0.5 && subnodes.length > 0) {
          subnodes.splice(Math.floor(Math.random() * subnodes.length), 1);
        } else {
          subnodes.splice(
            Math.floor(Math.random() * (subnodes.length + 1)),
            0,
            i2s36(did++),
          );
        }
      }

      const baseArray = getBaseSubnodesArray(sdidKnot);
      const delta = serializeCurSubnodes(subnodes.slice(0), baseArray);
      const restored = restoreSubnodesList(subnodesOld, delta);

      expect(restored).toEqual(subnodes);
    }
  });
});
