import { describe, it, expect } from 'vitest';
import {
  validateOperationsLog,
  operationsToHierarchy,
  hierarchyToOperations,
} from '../operations-codec';
import { DbOperationEnum } from '../../types/enums';
import { countNodes, hierarchiesEqual } from '../hierarchy-jso';
import type { HierarchyJSO } from '../../types/serialized';

// Helper to build a minimal valid operations log
function makeOpsLog(
  rootNode: Record<string, unknown>,
  inserts: Array<[Record<string, unknown>, number[]]> = [],
): unknown[] {
  const ops: unknown[] = [
    { type: DbOperationEnum.NODE_NEWROOT, node: rootNode },
  ];
  for (const [node, path] of inserts) {
    ops.push([DbOperationEnum.NODE_INSERT, node, path]);
  }
  ops.push({ type: DbOperationEnum.EOF, time: Date.now() });
  return ops;
}

describe('validateOperationsLog', () => {
  it('validates a minimal operations log', () => {
    const ops = makeOpsLog({ type: 'session', data: null });
    const result = validateOperationsLog(ops);
    expect(result.valid).toBe(true);
    expect(result.nodeCount).toBe(1);
    expect(result.saveTime).toBeTypeOf('number');
  });

  it('rejects null', () => {
    const result = validateOperationsLog(null as unknown as unknown[]);
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateOperationsLog([]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Too few');
  });

  it('rejects missing NODE_NEWROOT', () => {
    const result = validateOperationsLog([
      { type: 9999, node: {} },
      { type: DbOperationEnum.EOF, time: 0 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('NODE_NEWROOT');
  });

  it('rejects missing EOF', () => {
    const result = validateOperationsLog([
      { type: DbOperationEnum.NODE_NEWROOT, node: {} },
      { type: 9999 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EOF');
  });

  it('counts nodes correctly with inserts', () => {
    const ops = makeOpsLog({ type: 'session', data: null }, [
      [{ data: { url: 'a' } }, [0]],
      [{ data: { url: 'b' } }, [1]],
      [{ data: { url: 'c' } }, [0, 0]],
    ]);
    const result = validateOperationsLog(ops);
    expect(result.valid).toBe(true);
    expect(result.nodeCount).toBe(4); // 1 root + 3 inserts
  });
});

describe('operationsToHierarchy', () => {
  it('returns null for empty operations', () => {
    expect(operationsToHierarchy([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(operationsToHierarchy(null as unknown as unknown[])).toBeNull();
  });

  it('converts a root-only operations log', () => {
    const ops = makeOpsLog({ type: 'session', data: { treeId: 'test', nextDId: 0 } });
    const hierarchy = operationsToHierarchy(ops);
    expect(hierarchy).not.toBeNull();
    expect(hierarchy!.n.type).toBe('session');
    expect(hierarchy!.s).toBeUndefined();
  });

  it('converts operations log with children', () => {
    const ops = makeOpsLog(
      { type: 'session', data: { treeId: 'test', nextDId: 0 } },
      [
        [{ data: { url: 'https://a.com' } }, [0]],
        [{ data: { url: 'https://b.com' } }, [1]],
      ],
    );
    const hierarchy = operationsToHierarchy(ops);
    expect(hierarchy).not.toBeNull();
    expect(hierarchy!.s).toHaveLength(2);
    expect(hierarchy!.s![0].n.data).toEqual({ url: 'https://a.com' });
    expect(hierarchy!.s![1].n.data).toEqual({ url: 'https://b.com' });
  });

  it('handles nested insertions via paths', () => {
    const ops = makeOpsLog(
      { type: 'session', data: null },
      [
        [{ type: 'savedwin', data: null }, [0]],           // root → child[0]
        [{ data: { url: 'https://tab1.com' } }, [0, 0]],   // child[0] → grandchild[0]
        [{ data: { url: 'https://tab2.com' } }, [0, 1]],   // child[0] → grandchild[1]
      ],
    );
    const hierarchy = operationsToHierarchy(ops);
    expect(hierarchy!.s).toHaveLength(1);
    expect(hierarchy!.s![0].n.type).toBe('savedwin');
    expect(hierarchy!.s![0].s).toHaveLength(2);
    expect(hierarchy!.s![0].s![0].n.data).toEqual({ url: 'https://tab1.com' });
  });

  it('handles mixed object/array operation formats', () => {
    // Root is object format, insert is array format
    const ops = [
      { type: DbOperationEnum.NODE_NEWROOT, node: { type: 'session', data: null } },
      [DbOperationEnum.NODE_INSERT, { data: { url: 'test' } }, [0]],
      { type: DbOperationEnum.EOF, time: 12345 },
    ];
    const hierarchy = operationsToHierarchy(ops);
    expect(hierarchy).not.toBeNull();
    expect(hierarchy!.s).toHaveLength(1);
  });

  it('skips silently when path references non-existent child', () => {
    // Insert at [0, 5] when child[0] only has 0 children — path is corrupt
    const ops = makeOpsLog(
      { type: 'session', data: null },
      [
        [{ type: 'savedwin', data: null }, [0]],
        // child[0] has no children yet, so [0, 5] is invalid
        [{ data: { url: 'orphan' } }, [0, 5]],
        [{ data: { url: 'valid' } }, [1]],
      ],
    );
    const hierarchy = operationsToHierarchy(ops);
    expect(hierarchy).not.toBeNull();
    // Root should have 2 direct children (savedwin + valid)
    // The orphan insert should have been silently skipped
    expect(hierarchy!.s).toHaveLength(2);
    expect(hierarchy!.s![1].n.data).toEqual({ url: 'valid' });
  });

  it('normalizes mangled marks during conversion', () => {
    const ops = makeOpsLog(
      { type: 'session', data: null },
      [
        [{ data: { url: 'test' }, marks: { relicons: [], U: '#ff0000' } }, [0]],
      ],
    );
    const hierarchy = operationsToHierarchy(ops);
    const marks = hierarchy!.s![0].n.marks as unknown as Record<string, unknown>;
    expect(marks.customColorActive).toBe('#ff0000');
    expect(marks['U']).toBeUndefined();
  });
});

describe('hierarchyToOperations', () => {
  it('creates root + EOF for a leaf node', () => {
    const hierarchy: HierarchyJSO = { n: { type: 'session', data: null } };
    const ops = hierarchyToOperations(hierarchy);
    expect(ops.length).toBe(2); // root + EOF
    expect((ops[0] as { type: number }).type).toBe(DbOperationEnum.NODE_NEWROOT);
    expect((ops[ops.length - 1] as { type: number }).type).toBe(DbOperationEnum.EOF);
  });

  it('emits insert operations for children', () => {
    const hierarchy: HierarchyJSO = {
      n: { type: 'session', data: null },
      s: [
        { n: { data: { url: 'a' } } },
        { n: { data: { url: 'b' } } },
      ],
    };
    const ops = hierarchyToOperations(hierarchy);
    // root + 2 inserts + EOF
    expect(ops.length).toBe(4);
  });
});

describe('round-trip: operations ↔ hierarchy', () => {
  it('round-trips a simple tree', () => {
    const original: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 'test', nextDId: 100 } },
      s: [
        {
          n: { type: 'savedwin', data: null },
          s: [
            { n: { data: { url: 'https://a.com', title: 'A' } } },
            { n: { data: { url: 'https://b.com', title: 'B' } } },
          ],
        },
        { n: { type: 'textnote', data: { note: 'Hello' } } },
      ],
    };

    const ops = hierarchyToOperations(original);
    const restored = operationsToHierarchy(ops);
    expect(restored).not.toBeNull();
    expect(countNodes(restored!)).toBe(countNodes(original));
    expect(hierarchiesEqual(original, restored!)).toBe(true);
  });

  it('round-trips operations → hierarchy → operations → hierarchy', () => {
    const ops1 = makeOpsLog(
      { type: 'session', data: { treeId: 'x', nextDId: 50 } },
      [
        [{ type: 'savedwin', data: null }, [0]],
        [{ data: { url: 'https://test.com' } }, [0, 0]],
        [{ type: 'textnote', data: { note: 'note' } }, [1]],
      ],
    );

    const h1 = operationsToHierarchy(ops1);
    const ops2 = hierarchyToOperations(h1!);
    const h2 = operationsToHierarchy(ops2);

    expect(hierarchiesEqual(h1!, h2!)).toBe(true);
  });
});
