import { describe, it, expect, beforeEach } from 'vitest';
import { deserializeNode, restoreTree } from '../deserialize';
import { SessionTreeNode } from '../nodes/session-node';
import { TabTreeNode } from '../nodes/tab-node';
import { SavedTabTreeNode } from '../nodes/saved-tab-node';
import { WaitingTabTreeNode } from '../nodes/waiting-tab-node';
import { AttachWaitTabTreeNode } from '../nodes/attach-wait-tab-node';
import { WindowTreeNode } from '../nodes/window-node';
import { SavedWindowTreeNode } from '../nodes/saved-window-node';
import { WaitingWindowTreeNode } from '../nodes/waiting-window-node';
import { GroupTreeNode } from '../nodes/group-node';
import { TextNoteTreeNode } from '../nodes/text-note-node';
import { SeparatorTreeNode } from '../nodes/separator-node';
import { NodeTypesEnum } from '../../types/enums';
import type { HierarchyJSO, SerializedNode } from '../../types/serialized';
import { resetMvcIdCounter } from '../mvc-id';

describe('deserializeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('defaults to SavedTabTreeNode when type is absent', () => {
    const node = deserializeNode({ data: { url: 'https://example.com', title: 'Ex' } });
    expect(node).toBeInstanceOf(SavedTabTreeNode);
    expect(node!.type).toBe(NodeTypesEnum.SAVEDTAB);
  });

  it('deserializes session node', () => {
    const node = deserializeNode({
      type: 'session',
      data: { treeId: 't1', nextDId: 5, nonDumpedDId: 1 },
    });
    expect(node).toBeInstanceOf(SessionTreeNode);
    expect((node as SessionTreeNode).treeId).toBe('t1');
  });

  it('deserializes active tab node', () => {
    const node = deserializeNode({
      type: 'tab',
      data: { url: 'https://example.com', title: 'Tab', active: true },
    });
    expect(node).toBeInstanceOf(TabTreeNode);
    expect(node!.isAnOpenTab()).toBe(true);
  });

  it('deserializes saved tab node (explicit type)', () => {
    // savedtab is excluded from the type field (omitted = savedtab).
    // When it IS present in legacy data, normalizeSerializedNode strips it.
    const node = deserializeNode({
      data: { url: 'https://example.com' },
    });
    expect(node).toBeInstanceOf(SavedTabTreeNode);
  });

  it('deserializes waiting tab node', () => {
    const node = deserializeNode({
      type: 'waitingtab',
      data: { url: 'https://example.com' },
    });
    expect(node).toBeInstanceOf(WaitingTabTreeNode);
  });

  it('deserializes attach wait tab node', () => {
    const node = deserializeNode({
      type: 'attachwaitingtab',
      data: { url: 'https://example.com' },
    });
    expect(node).toBeInstanceOf(AttachWaitTabTreeNode);
  });

  it('deserializes active window node', () => {
    const node = deserializeNode({
      type: 'win',
      data: { id: 1, type: 'normal', focused: true },
    });
    expect(node).toBeInstanceOf(WindowTreeNode);
    expect(node!.isAnOpenWindow()).toBe(true);
  });

  it('deserializes saved window node', () => {
    const node = deserializeNode({
      type: 'savedwin',
      data: { id: 2 },
    });
    expect(node).toBeInstanceOf(SavedWindowTreeNode);
  });

  it('deserializes waiting window node', () => {
    const node = deserializeNode({
      type: 'waitingwin',
      data: {},
    });
    expect(node).toBeInstanceOf(WaitingWindowTreeNode);
  });

  it('deserializes group node', () => {
    const node = deserializeNode({ type: 'group', data: null });
    expect(node).toBeInstanceOf(GroupTreeNode);
  });

  it('deserializes text note node', () => {
    const node = deserializeNode({
      type: 'textnote',
      data: { note: 'Hello' },
    });
    expect(node).toBeInstanceOf(TextNoteTreeNode);
    expect(node!.getNodeText()).toBe('Hello');
  });

  it('deserializes separator node', () => {
    const node = deserializeNode({
      type: 'separatorline',
      data: { separatorIndx: 1 },
    });
    expect(node).toBeInstanceOf(SeparatorTreeNode);
    expect(node!.getNodeContentCssClass()).toBe('a');
  });

  it('applies collapsed state', () => {
    const node = deserializeNode({
      data: { url: 'test' },
      colapsed: true,
    } as SerializedNode);
    expect(node!.colapsed).toBe(true);
  });

  it('applies marks', () => {
    const node = deserializeNode({
      data: { url: 'test' },
      marks: { relicons: [], customTitle: 'Custom' },
    } as SerializedNode);
    expect(node!.marks.customTitle).toBe('Custom');
  });

  it('normalizes mangled marks from legacy builds', () => {
    // v0.4.28 mangled names: U → customColorActive, V → customColorSaved
    const raw = {
      data: { url: 'test' },
      marks: { relicons: [], U: '#ff0000', V: '#00ff00' },
    } as unknown as SerializedNode;
    const node = deserializeNode(raw);
    expect(node!.marks.customColorActive).toBe('#ff0000');
    expect(node!.marks.customColorSaved).toBe('#00ff00');
  });

  it('applies diff IDs', () => {
    const node = deserializeNode({
      data: null,
      type: 'group',
      dId: 10,
      cdId: 11,
      sdId: 12,
      sdIdKnot: 'knot',
    } as SerializedNode);
    expect(node!.dId).toBe(10);
    expect(node!.cdId).toBe(11);
    expect(node!.sdId).toBe(12);
    expect(node!.sdIdKnot).toBe('knot');
  });

  it('returns null for unrecognized type', () => {
    const node = deserializeNode({
      type: 'unknown_type' as any,
      data: null,
    });
    expect(node).toBeNull();
  });
});

describe('restoreTree', () => {
  beforeEach(() => resetMvcIdCounter());

  it('restores a single node', () => {
    const jso: HierarchyJSO = {
      n: { data: { note: 'Root' }, type: 'textnote' },
    };
    const tree = restoreTree(jso);
    expect(tree).toBeInstanceOf(TextNoteTreeNode);
    expect(tree!.subnodes).toHaveLength(0);
  });

  it('restores a tree with children', () => {
    const jso: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 't', nextDId: 1, nonDumpedDId: 1 } },
      s: [
        {
          n: { type: 'savedwin', data: { id: 1 } },
          s: [
            { n: { data: { url: 'https://a.com', title: 'A' } } },
            { n: { data: { url: 'https://b.com', title: 'B' } } },
          ],
        },
        { n: { type: 'group', data: null } },
      ],
    };

    const tree = restoreTree(jso);
    expect(tree).toBeInstanceOf(SessionTreeNode);
    expect(tree!.subnodes).toHaveLength(2);

    const win = tree!.subnodes[0];
    expect(win).toBeInstanceOf(SavedWindowTreeNode);
    expect(win.subnodes).toHaveLength(2);
    expect(win.subnodes[0]).toBeInstanceOf(SavedTabTreeNode);
    expect(win.subnodes[1]).toBeInstanceOf(SavedTabTreeNode);

    const group = tree!.subnodes[1];
    expect(group).toBeInstanceOf(GroupTreeNode);
  });

  it('establishes parent-child relationships', () => {
    const jso: HierarchyJSO = {
      n: { type: 'group', data: null },
      s: [{ n: { data: { url: 'test' } } }],
    };

    const tree = restoreTree(jso);
    expect(tree!.subnodes[0].parent).toBe(tree);
  });

  it('returns null when root is invalid', () => {
    const jso: HierarchyJSO = {
      n: { type: 'unknown' as any, data: null },
    };
    expect(restoreTree(jso)).toBeNull();
  });

  it('skips invalid children', () => {
    const jso: HierarchyJSO = {
      n: { type: 'group', data: null },
      s: [
        { n: { data: { url: 'valid' } } },
        { n: { type: 'unknown' as any, data: null } },
        { n: { data: { url: 'also-valid' } } },
      ],
    };

    const tree = restoreTree(jso);
    // The valid children are inserted, the invalid one is skipped
    expect(tree!.subnodes).toHaveLength(2);
  });
});
