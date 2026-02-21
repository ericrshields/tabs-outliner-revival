import { describe, it, expect, beforeEach } from 'vitest';
import { TreeModel } from '../../tree-model';
import { hierarchiesEqual } from '../../../serialization/hierarchy-jso';
import type { HierarchyJSO } from '../../../types/serialized';
import { resetMvcIdCounter } from '../../mvc-id';

/**
 * Deep equality check for HierarchyJSO that ignores key ordering.
 * `hierarchiesEqual` uses JSON.stringify which is key-order-sensitive.
 * This helper recursively compares via `toEqual` semantics.
 */
function assertHierarchyEqual(a: HierarchyJSO, b: HierarchyJSO): void {
  expect(b.n).toEqual(a.n);

  const aChildren = a.s ?? [];
  const bChildren = b.s ?? [];
  expect(bChildren.length).toBe(aChildren.length);

  for (let i = 0; i < aChildren.length; i++) {
    assertHierarchyEqual(aChildren[i], bChildren[i]);
  }
}

describe('Round-trip: HierarchyJSO → TreeModel → HierarchyJSO', () => {
  beforeEach(() => resetMvcIdCounter());

  it('round-trips a simple session with saved tabs', () => {
    const jso: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 } },
      s: [
        {
          n: { type: 'savedwin', data: { id: 1 } },
          s: [
            { n: { data: { url: 'https://a.com', title: 'A' } } },
            { n: { data: { url: 'https://b.com', title: 'B' } } },
          ],
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const roundTripped = model.toHierarchyJSO();

    expect(hierarchiesEqual(jso, roundTripped)).toBe(true);
  });

  it('round-trips all 11 node types', () => {
    const jso: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 } },
      s: [
        {
          n: { type: 'win', data: { id: 1, type: 'normal', focused: true } },
          s: [
            { n: { type: 'tab', data: { id: 101, url: 'https://a.com', title: 'A', active: true } } },
            { n: { type: 'attachwaitingtab', data: { id: 102, url: 'https://b.com', title: 'B', active: true } } },
          ],
        },
        {
          n: { type: 'savedwin', data: { id: 2 } },
          s: [
            { n: { data: { url: 'https://c.com', title: 'C' } } },
            { n: { type: 'waitingtab', data: { url: 'https://d.com', title: 'D' } } },
          ],
        },
        { n: { type: 'waitingwin', data: {} } },
        {
          n: { type: 'group', data: null },
          s: [{ n: { data: { url: 'https://e.com', title: 'E' } } }],
        },
        { n: { type: 'textnote', data: { note: 'Hello' } } },
        { n: { type: 'separatorline', data: { separatorIndx: 1 } } },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const roundTripped = model.toHierarchyJSO();

    expect(hierarchiesEqual(jso, roundTripped)).toBe(true);
  });

  it('round-trips marks and collapsed state', () => {
    const jso: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 } },
      s: [
        {
          n: {
            type: 'savedwin',
            data: { id: 1 },
            colapsed: true,
            marks: {
              relicons: [{ src: 'img/star.png', w: 16, h: 16 }],
              customTitle: 'My Window',
              customFavicon: 'img/custom.png',
            },
          },
          s: [
            {
              n: {
                data: { url: 'https://a.com', title: 'A' },
                marks: {
                  relicons: [],
                  customColorSaved: '#ff0000',
                },
              },
            },
          ],
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const roundTripped = model.toHierarchyJSO();

    // Use key-order-independent comparison
    assertHierarchyEqual(jso, roundTripped);

    // Also verify specific fields preserved
    const winNode = roundTripped.s![0].n;
    expect(winNode.colapsed).toBe(true);
    expect(winNode.marks!.customTitle).toBe('My Window');
    expect(winNode.marks!.customFavicon).toBe('img/custom.png');
    expect(winNode.marks!.relicons).toHaveLength(1);

    const tabNode = roundTripped.s![0].s![0].n;
    expect(tabNode.marks!.customColorSaved).toBe('#ff0000');
  });

  it('round-trips diff IDs', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 100, nonDumpedDId: 50 },
        dId: 10,
        cdId: 11,
        sdId: 12,
        sdIdKnot: 'b@c&d',
      },
      s: [
        {
          n: {
            type: 'savedwin',
            data: { id: 1 },
            dId: 20,
            cdId: 21,
          },
          s: [
            { n: { data: { url: 'https://a.com' }, dId: 30, cdId: 31 } },
          ],
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const roundTripped = model.toHierarchyJSO();

    // Use key-order-independent comparison
    assertHierarchyEqual(jso, roundTripped);

    // Verify specific diff IDs preserved
    expect(roundTripped.n.dId).toBe(10);
    expect(roundTripped.n.cdId).toBe(11);
    expect(roundTripped.n.sdId).toBe(12);
    expect(roundTripped.n.sdIdKnot).toBe('b@c&d');
    expect(roundTripped.s![0].n.dId).toBe(20);
    expect(roundTripped.s![0].n.cdId).toBe(21);
    expect(roundTripped.s![0].s![0].n.dId).toBe(30);
    expect(roundTripped.s![0].s![0].n.cdId).toBe(31);
  });

  it('normalizes legacy mangled marks during round-trip', () => {
    const inputJso: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 't', nextDId: 1, nonDumpedDId: 1 } },
      s: [
        {
          n: {
            data: { url: 'https://a.com', title: 'A' },
            marks: { relicons: [], U: '#ff0000', J: 'Custom Title' } as any,
          },
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(inputJso);
    const roundTripped = model.toHierarchyJSO();

    const tabMarks = roundTripped.s![0].n.marks!;
    expect(tabMarks.customColorActive).toBe('#ff0000');
    expect(tabMarks.customTitle).toBe('Custom Title');
    expect((tabMarks as any).U).toBeUndefined();
    expect((tabMarks as any).J).toBeUndefined();
  });

  it('produces output that hierarchiesEqual validates (serialize then parse)', () => {
    // Build from API, serialize, re-parse, and compare — key order matches
    const model = TreeModel.createEmpty();
    const jso1 = model.toHierarchyJSO();

    const model2 = TreeModel.fromHierarchyJSO(jso1);
    const jso2 = model2.toHierarchyJSO();

    expect(hierarchiesEqual(jso1, jso2)).toBe(true);
  });
});
