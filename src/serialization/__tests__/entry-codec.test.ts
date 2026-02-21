import { describe, it, expect } from 'vitest';
import { decodeEntry, encodeEntry } from '../entry-codec';
import type { SerializedNode } from '@/types/serialized';
import type { NodeMarks } from '@/types/marks';

describe('decodeEntry', () => {
  it('decodes a savedtab (type 5, positive = expanded)', () => {
    const json = JSON.stringify([5, { url: 'https://example.com', title: 'Example' }]);
    const node = decodeEntry(json);
    expect(node.type).toBeUndefined(); // savedtab is default, omitted
    expect(node.colapsed).toBeUndefined();
    expect(node.data).toEqual({ url: 'https://example.com', title: 'Example' });
  });

  it('decodes a collapsed tab (negative type code)', () => {
    const json = JSON.stringify([-4, { url: 'https://test.com' }]);
    const node = decodeEntry(json);
    expect(node.type).toBe('tab');
    expect(node.colapsed).toBe(true);
    expect(node.data).toEqual({ url: 'https://test.com' });
  });

  it('decodes with marks', () => {
    const marks: NodeMarks = {
      relicons: [],
      customTitle: 'My Tab',
    };
    const json = JSON.stringify([5, { url: 'https://test.com' }, marks]);
    const node = decodeEntry(json);
    expect(node.marks).toEqual(marks);
  });

  it('decodes each node type by index', () => {
    // Index mapping: 1=session, 2=textnote, 3=separatorline, 4=tab,
    // 5=savedtab, 6=group, 7=win, 8=savedwin, 9=attachwaitingtab,
    // 10=waitingwin, 11=waitingtab
    const cases: Array<[number, string | undefined]> = [
      [1, 'session'],
      [2, 'textnote'],
      [3, 'separatorline'],
      [4, 'tab'],
      [5, undefined], // savedtab → omitted
      [6, 'group'],
      [7, 'win'],
      [8, 'savedwin'],
      [9, 'attachwaitingtab'],
      [10, 'waitingwin'],
      [11, 'waitingtab'],
    ];

    for (const [typeNum, expectedType] of cases) {
      const json = JSON.stringify([typeNum, null]);
      const node = decodeEntry(json);
      expect(node.type).toBe(expectedType);
    }
  });

  it('falls back to savedtab for out-of-range type code', () => {
    const json = JSON.stringify([999, { url: 'https://unknown.com' }]);
    const node = decodeEntry(json);
    // Out-of-range type code should fall back to savedtab (undefined type)
    expect(node.type).toBeUndefined();
    expect(node.data).toEqual({ url: 'https://unknown.com' });
  });

  it('decodes type code 0 as ZERO (reserved slot)', () => {
    const json = JSON.stringify([0, { url: 'https://zero.com' }]);
    const node = decodeEntry(json);
    // Index 0 maps to 'ZERO' — the reserved slot. decodeEntry preserves it;
    // downstream validation (isValidHierarchyJSO) rejects 'ZERO' as invalid.
    expect(node.type).toBe('ZERO');
    expect(node.data).toEqual({ url: 'https://zero.com' });
  });

  it('decodes collapsed node types correctly', () => {
    // Collapsed session (type 1)
    const json = JSON.stringify([-1, { treeId: 'test', nextDId: 0 }]);
    const node = decodeEntry(json);
    expect(node.type).toBe('session');
    expect(node.colapsed).toBe(true);
  });
});

describe('encodeEntry', () => {
  it('encodes a savedtab (default type)', () => {
    const node: SerializedNode = { data: { url: 'https://example.com' } };
    const tuple = encodeEntry(node);
    expect(tuple[0]).toBe(5); // savedtab = index 5
    expect(tuple[1]).toEqual({ url: 'https://example.com' });
    expect(tuple.length).toBe(2);
  });

  it('encodes a collapsed tab', () => {
    const node: SerializedNode = {
      type: 'tab',
      colapsed: true,
      data: { url: 'https://test.com' },
    };
    const tuple = encodeEntry(node);
    expect(tuple[0]).toBe(-4); // tab=4, collapsed=negative
  });

  it('includes marks when present', () => {
    const marks: NodeMarks = { relicons: [], customTitle: 'Custom' };
    const node: SerializedNode = { data: null, marks };
    const tuple = encodeEntry(node);
    expect(tuple.length).toBe(3);
    expect(tuple[2]).toEqual(marks);
  });

  it('round-trips all node types', () => {
    const types = [
      undefined, // savedtab
      'session',
      'textnote',
      'separatorline',
      'tab',
      'group',
      'win',
      'savedwin',
      'attachwaitingtab',
      'waitingwin',
      'waitingtab',
    ] as const;

    for (const type of types) {
      const typeStr = type as string;
      const node: SerializedNode = {
        ...(typeStr && typeStr !== 'savedtab' ? { type } : {}),
        data: { test: true },
      } as SerializedNode;

      const encoded = encodeEntry(node);
      const decoded = decodeEntry(JSON.stringify(encoded));
      expect(decoded.type).toBe(node.type);
      expect(decoded.data).toEqual(node.data);
    }
  });

  it('round-trips collapsed state', () => {
    for (const colapsed of [true, false, undefined]) {
      const node: SerializedNode = {
        type: 'win',
        ...(colapsed ? { colapsed } : {}),
        data: null,
      } as SerializedNode;

      const encoded = encodeEntry(node);
      const decoded = decodeEntry(JSON.stringify(encoded));
      expect(!!decoded.colapsed).toBe(!!colapsed);
    }
  });
});
