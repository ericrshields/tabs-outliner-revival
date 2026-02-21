import { describe, it, expect } from 'vitest';
import {
  isValidHierarchyJSO,
  normalizeSerializedNode,
  countNodes,
  hierarchiesEqual,
  importTreeFile,
  exportTreeFile,
} from '../hierarchy-jso';
import type { HierarchyJSO } from '@/types/serialized';

describe('isValidHierarchyJSO', () => {
  it('accepts a minimal valid hierarchy', () => {
    expect(isValidHierarchyJSO({ n: { data: null } })).toBe(true);
  });

  it('accepts a hierarchy with subnodes', () => {
    const h: HierarchyJSO = {
      n: { data: null, type: 'session' },
      s: [{ n: { data: { url: 'test' } } }],
    };
    expect(isValidHierarchyJSO(h)).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidHierarchyJSO(null)).toBe(false);
  });

  it('rejects missing n', () => {
    expect(isValidHierarchyJSO({ s: [] })).toBe(false);
  });

  it('rejects n without data', () => {
    expect(isValidHierarchyJSO({ n: { type: 'tab' } })).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(isValidHierarchyJSO({ n: { type: 'invalid', data: null } })).toBe(false);
  });

  it('rejects ZERO type', () => {
    expect(isValidHierarchyJSO({ n: { type: 'ZERO', data: null } })).toBe(false);
  });

  it('rejects non-array subnodes', () => {
    expect(isValidHierarchyJSO({ n: { data: null }, s: 'invalid' })).toBe(false);
  });

  it('rejects invalid child in subnodes', () => {
    expect(
      isValidHierarchyJSO({ n: { data: null }, s: [{ n: { nodata: true } }] }),
    ).toBe(false);
  });
});

describe('normalizeSerializedNode', () => {
  it('passes through a normal node unchanged', () => {
    const raw = { type: 'tab', data: { url: 'test' }, marks: { relicons: [] } };
    const result = normalizeSerializedNode(raw);
    expect(result.data).toEqual({ url: 'test' });
  });

  it('normalizes v0.4.28 mangled marks (U, V)', () => {
    const raw = {
      data: null,
      marks: { relicons: [], U: '#ff0000', V: '#00ff00' },
    };
    const result = normalizeSerializedNode(raw);
    const marks = result.marks as unknown as Record<string, unknown>;
    expect(marks.customColorActive).toBe('#ff0000');
    expect(marks.customColorSaved).toBe('#00ff00');
    expect(marks['U']).toBeUndefined();
    expect(marks['V']).toBeUndefined();
  });

  it('normalizes v0.4.27 mangled marks (J, u)', () => {
    const raw = {
      data: null,
      marks: { relicons: [], J: 'My Title', u: 'icon.png' },
    };
    const result = normalizeSerializedNode(raw);
    const marks = result.marks as unknown as Record<string, unknown>;
    expect(marks.customTitle).toBe('My Title');
    expect(marks.customFavicon).toBe('icon.png');
  });

  it('v0.4.28 W/I override v0.4.27 J/u', () => {
    const raw = {
      data: null,
      marks: { relicons: [], J: 'old', W: 'new', u: 'old.png', I: 'new.png' },
    };
    const result = normalizeSerializedNode(raw);
    const marks = result.marks as unknown as Record<string, unknown>;
    expect(marks.customTitle).toBe('new');
    expect(marks.customFavicon).toBe('new.png');
  });

  it('is idempotent', () => {
    const raw = {
      data: null,
      marks: { relicons: [], U: '#ff0000', J: 'Title' },
    };
    const first = normalizeSerializedNode(raw);
    const second = normalizeSerializedNode(first as unknown as Record<string, unknown>);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('handles missing marks', () => {
    const raw = { data: null };
    const result = normalizeSerializedNode(raw);
    expect(result.marks).toBeUndefined();
  });

  it('ensures relicons array exists in marks', () => {
    const raw = { data: null, marks: {} };
    const result = normalizeSerializedNode(raw);
    expect((result.marks as unknown as Record<string, unknown>).relicons).toEqual([]);
  });

  it('converts non-array truthy relicons to empty array', () => {
    const raw = { data: null, marks: { relicons: 'not-an-array' } };
    const result = normalizeSerializedNode(raw);
    expect((result.marks as unknown as Record<string, unknown>).relicons).toEqual([]);
  });

  it('converts numeric relicons to empty array', () => {
    const raw = { data: null, marks: { relicons: 42 } };
    const result = normalizeSerializedNode(raw);
    expect((result.marks as unknown as Record<string, unknown>).relicons).toEqual([]);
  });

  it('copies relicons array (not same reference)', () => {
    const originalRelicons = ['icon1', 'icon2'];
    const raw = { data: null, marks: { relicons: originalRelicons } };
    const result = normalizeSerializedNode(raw);
    const marks = result.marks as unknown as Record<string, unknown>;
    expect(marks.relicons).toEqual(['icon1', 'icon2']);
    // Must be a different reference (defensive copy)
    expect(marks.relicons).not.toBe(originalRelicons);
  });

  it('does not mutate the input marks object', () => {
    const raw = {
      data: null,
      marks: { relicons: [], U: '#ff0000', J: 'Title' },
    };
    const originalMarks = { ...raw.marks };
    normalizeSerializedNode(raw);
    // Original marks should still have the mangled keys
    expect(raw.marks.U).toBe('#ff0000');
    expect(raw.marks.J).toBe('Title');
  });
});

describe('countNodes', () => {
  it('counts a single node', () => {
    expect(countNodes({ n: { data: null } })).toBe(1);
  });

  it('counts a tree with children', () => {
    const tree: HierarchyJSO = {
      n: { data: null },
      s: [
        { n: { data: null }, s: [{ n: { data: null } }] },
        { n: { data: null } },
      ],
    };
    expect(countNodes(tree)).toBe(4);
  });
});

describe('hierarchiesEqual', () => {
  it('returns true for identical trees', () => {
    const tree: HierarchyJSO = {
      n: { data: { url: 'test' } },
      s: [{ n: { data: null } }],
    };
    expect(hierarchiesEqual(tree, tree)).toBe(true);
  });

  it('returns false for different node data', () => {
    const a: HierarchyJSO = { n: { data: { url: 'a' } } };
    const b: HierarchyJSO = { n: { data: { url: 'b' } } };
    expect(hierarchiesEqual(a, b)).toBe(false);
  });

  it('returns false for different child count', () => {
    const a: HierarchyJSO = { n: { data: null }, s: [{ n: { data: null } }] };
    const b: HierarchyJSO = { n: { data: null } };
    expect(hierarchiesEqual(a, b)).toBe(false);
  });
});

describe('importTreeFile / exportTreeFile', () => {
  it('round-trips a hierarchy', () => {
    const tree: HierarchyJSO = {
      n: { data: { note: 'test' }, type: 'textnote' },
      s: [{ n: { data: null } }],
    };
    const json = exportTreeFile(tree);
    const imported = importTreeFile(json);
    expect(hierarchiesEqual(tree, imported)).toBe(true);
  });

  it('throws on invalid JSON', () => {
    expect(() => importTreeFile('not json')).toThrow();
  });

  it('throws on invalid structure', () => {
    expect(() => importTreeFile('{"x": 1}')).toThrow('Invalid .tree file');
  });
});
