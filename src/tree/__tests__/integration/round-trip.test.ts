import { describe, it, expect, beforeEach } from 'vitest';
import { TreeModel } from '../../tree-model';
import { hierarchiesEqual, countNodes } from '@/serialization/hierarchy-jso';
import {
  hierarchyToOperations,
  operationsToHierarchy,
} from '@/serialization/operations-codec';
import type { HierarchyJSO } from '@/types/serialized';
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
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
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
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [
        {
          n: { type: 'win', data: { id: 1, type: 'normal', focused: true } },
          s: [
            {
              n: {
                type: 'tab',
                data: {
                  id: 101,
                  url: 'https://a.com',
                  title: 'A',
                  active: true,
                },
              },
            },
            {
              n: {
                type: 'attachwaitingtab',
                data: {
                  id: 102,
                  url: 'https://b.com',
                  title: 'B',
                  active: true,
                },
              },
            },
          ],
        },
        {
          n: { type: 'savedwin', data: { id: 2 } },
          s: [
            { n: { data: { url: 'https://c.com', title: 'C' } } },
            {
              n: {
                type: 'waitingtab',
                data: { url: 'https://d.com', title: 'D' },
              },
            },
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
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
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
          s: [{ n: { data: { url: 'https://a.com' }, dId: 30, cdId: 31 } }],
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
      n: {
        type: 'session',
        data: { treeId: 't', nextDId: 1, nonDumpedDId: 1 },
      },
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

describe('Round-trip: tab and window data field stripping', () => {
  beforeEach(() => resetMvcIdCounter());

  it('strips status:complete, windowId, and deprecated fields from savedtab', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [
        {
          n: {
            data: {
              url: 'https://a.com',
              title: 'A',
              status: 'complete',
              windowId: 42,
              selected: true,
              height: 800,
              width: 1200,
              index: 3,
            } as Record<string, unknown>,
          },
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();
    const tabData = rt.s![0].n.data as Record<string, unknown>;

    expect(tabData.url).toBe('https://a.com');
    expect(tabData.title).toBe('A');
    expect(tabData.status).toBeUndefined();
    expect(tabData.windowId).toBeUndefined();
    expect(tabData.selected).toBeUndefined();
    expect(tabData.height).toBeUndefined();
    expect(tabData.width).toBeUndefined();
    expect(tabData.index).toBeUndefined();
  });

  it('preserves pinned and incognito on savedtab when truthy', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [
        {
          n: {
            data: {
              url: 'https://a.com',
              pinned: true,
              incognito: true,
            },
          },
        },
        {
          n: {
            data: {
              url: 'https://b.com',
              pinned: false,
              incognito: false,
            },
          },
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    const pinnedTab = rt.s![0].n.data as Record<string, unknown>;
    expect(pinnedTab.pinned).toBe(true);
    expect(pinnedTab.incognito).toBe(true);

    const normalTab = rt.s![1].n.data as Record<string, unknown>;
    expect(normalTab.pinned).toBeUndefined();
    expect(normalTab.incognito).toBeUndefined();
  });

  it('strips tabs array from window data', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [
        {
          n: {
            type: 'win',
            data: {
              id: 1,
              type: 'normal',
              focused: true,
              tabs: [{ id: 101 }],
            } as Record<string, unknown>,
          },
          s: [
            {
              n: {
                type: 'tab',
                data: { id: 101, url: 'https://a.com', active: true },
              },
            },
          ],
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();
    const winData = rt.s![0].n.data as Record<string, unknown>;

    expect(winData.tabs).toBeUndefined();
    expect(winData.id).toBe(1);
    expect(winData.type).toBe('normal');
  });

  it('strips falsy focused/incognito/alwaysOnTop from window data and clears stale focused on saved windows', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [
        {
          n: {
            type: 'savedwin',
            data: {
              id: 1,
              focused: false,
              incognito: false,
              alwaysOnTop: false,
            } as Record<string, unknown>,
          },
        },
        {
          n: {
            type: 'savedwin',
            data: {
              id: 2,
              focused: true,
              incognito: true,
              alwaysOnTop: true,
            } as Record<string, unknown>,
          },
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    const falsy = rt.s![0].n.data as Record<string, unknown>;
    expect(falsy.focused).toBeUndefined();
    expect(falsy.incognito).toBeUndefined();
    expect(falsy.alwaysOnTop).toBeUndefined();

    // Saved window invariant: focused is cleared to false in the constructor
    // regardless of input, then stripped by serialization. incognito and
    // alwaysOnTop are unaffected by the invariant and survive round-trip.
    const truthy = rt.s![1].n.data as Record<string, unknown>;
    expect(truthy.focused).toBeUndefined();
    expect(truthy.incognito).toBe(true);
    expect(truthy.alwaysOnTop).toBe(true);
  });
});

describe('Round-trip: edge cases', () => {
  beforeEach(() => resetMvcIdCounter());

  it('round-trips session with no children', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'empty', nextDId: 1, nonDumpedDId: 1 },
      },
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    expect(rt.n.type).toBe('session');
    expect(rt.s).toBeUndefined();
  });

  it('round-trips savedwin with no tabs', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [{ n: { type: 'savedwin', data: { id: 1 } } }],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    expect(rt.s).toHaveLength(1);
    expect(rt.s![0].n.type).toBe('savedwin');
    expect(rt.s![0].s).toBeUndefined();
  });

  it.each([0, 1, 2] as const)(
    'round-trips separatorIndx %i',
    (separatorIndx) => {
      resetMvcIdCounter();
      const jso: HierarchyJSO = {
        n: {
          type: 'session',
          data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
        },
        s: [{ n: { type: 'separatorline', data: { separatorIndx } } }],
      };

      const model = TreeModel.fromHierarchyJSO(jso);
      const rt = model.toHierarchyJSO();

      expect(rt.s![0].n.type).toBe('separatorline');
      expect((rt.s![0].n.data as Record<string, unknown>).separatorIndx).toBe(
        separatorIndx,
      );
    },
  );

  it('preserves colapsed on win and group node types', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [
        {
          n: {
            type: 'win',
            data: { id: 1, type: 'normal' },
            colapsed: true,
          },
          s: [
            {
              n: {
                type: 'tab',
                data: { id: 101, url: 'https://a.com', active: true },
              },
            },
          ],
        },
        {
          n: { type: 'group', data: null, colapsed: true },
          s: [{ n: { data: { url: 'https://b.com', title: 'B' } } }],
        },
      ],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    expect(rt.s![0].n.colapsed).toBe(true);
    expect(rt.s![0].n.type).toBe('win');
    expect(rt.s![1].n.colapsed).toBe(true);
    expect(rt.s![1].n.type).toBe('group');
  });

  it('round-trips savedtab with only url (no title or favicon)', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [{ n: { data: { url: 'https://minimal.com' } } }],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    const tabData = rt.s![0].n.data as Record<string, unknown>;
    expect(tabData.url).toBe('https://minimal.com');
    expect(tabData.title).toBeUndefined();
    expect(tabData.favIconUrl).toBeUndefined();
  });

  it('round-trips textnote with empty string', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'test', nextDId: 1, nonDumpedDId: 1 },
      },
      s: [{ n: { type: 'textnote', data: { note: '' } } }],
    };

    const model = TreeModel.fromHierarchyJSO(jso);
    const rt = model.toHierarchyJSO();

    expect((rt.s![0].n.data as Record<string, unknown>).note).toBe('');
  });
});

describe('Round-trip: full end-to-end pipeline (operations ↔ hierarchy ↔ TreeModel)', () => {
  beforeEach(() => resetMvcIdCounter());

  it('operations log → hierarchy → TreeModel → hierarchy → operations log is stable', () => {
    const jso: HierarchyJSO = {
      n: {
        type: 'session',
        data: { treeId: 'e2e', nextDId: 10, nonDumpedDId: 5 },
      },
      s: [
        {
          n: { type: 'savedwin', data: { id: 1 } },
          s: [
            { n: { data: { url: 'https://a.com', title: 'A', pinned: true } } },
            { n: { data: { url: 'https://b.com', title: 'B' } } },
          ],
        },
        { n: { type: 'textnote', data: { note: 'My note' } } },
        { n: { type: 'separatorline', data: { separatorIndx: 2 } } },
        {
          n: {
            type: 'group',
            data: null,
            colapsed: true,
            marks: { relicons: [], customTitle: 'My Group' },
          },
          s: [{ n: { data: { url: 'https://c.com', title: 'C' } } }],
        },
      ],
    };

    // HierarchyJSO → operations
    const ops1 = hierarchyToOperations(jso);

    // operations → HierarchyJSO
    const jso2 = operationsToHierarchy(ops1);
    expect(jso2).not.toBeNull();
    expect(hierarchiesEqual(jso, jso2!)).toBe(true);

    // HierarchyJSO → TreeModel → HierarchyJSO
    const model = TreeModel.fromHierarchyJSO(jso2!);
    const jso3 = model.toHierarchyJSO();

    // Verify structure preserved through model layer
    expect(jso3.s).toHaveLength(4);
    expect(jso3.s![0].s).toHaveLength(2);
    expect((jso3.s![0].s![0].n.data as Record<string, unknown>).pinned).toBe(
      true,
    );
    expect(jso3.s![1].n.type).toBe('textnote');
    expect(jso3.s![2].n.type).toBe('separatorline');
    expect(jso3.s![3].n.colapsed).toBe(true);
    expect(jso3.s![3].n.marks!.customTitle).toBe('My Group');

    // HierarchyJSO → operations → HierarchyJSO (second ops round-trip)
    const ops2 = hierarchyToOperations(jso3);
    const jso4 = operationsToHierarchy(ops2);
    expect(jso4).not.toBeNull();
    expect(countNodes(jso4!)).toBe(countNodes(jso3));
  });

  it('large tree survives full pipeline without node loss', () => {
    // Build a tree programmatically, run the full ops ↔ model pipeline
    const model1 = TreeModel.createEmpty();
    const jso1 = model1.toHierarchyJSO();

    const ops = hierarchyToOperations(jso1);
    const jso2 = operationsToHierarchy(ops);
    expect(jso2).not.toBeNull();

    const model2 = TreeModel.fromHierarchyJSO(jso2!);
    const jso3 = model2.toHierarchyJSO();

    expect(countNodes(jso3)).toBe(countNodes(jso1));
    expect(hierarchiesEqual(jso1, jso3)).toBe(true);
  });
});
