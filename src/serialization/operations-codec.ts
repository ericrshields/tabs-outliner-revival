/**
 * Operations log ↔ HierarchyJSO codec.
 *
 * Port of treemodel.js:2640-2671 (decode) and treemodel.js:821-848 (encode).
 *
 * IMPORTANT: The `OperationLogEntry` type in `src/types/operations.ts` is the
 * in-memory class-based format. The wire format stored in IndexedDB is simpler:
 * plain objects {type, node} for root/EOF, plain arrays [type, node, path] for inserts.
 * We define local `Wire*` types here for the actual on-disk shape.
 */

import { DbOperationEnum } from '../types/enums';
import type { SerializedNode, HierarchyJSO } from '../types/serialized';

import { normalizeSerializedNode } from './hierarchy-jso';

// -- Wire format types (on-disk shape in IndexedDB) --

/** Root operation: {type: 2000, node: {...}} */
export type WireRootOp = { type: number; node: Record<string, unknown> };

/** Insert operation: [2001, {...node}, [path, indices]] */
export type WireInsertOp = [number, Record<string, unknown>, number[]];

/** EOF operation: {type: 11111, time: timestamp} */
export type WireEofOp = { type: number; time: number };

/** Union of all wire operation formats */
export type WireOperation = WireRootOp | WireInsertOp | WireEofOp;

/**
 * Validate an operations log structure.
 *
 * Requires operations[0].type === NODE_NEWROOT and operations[last].type === EOF,
 * matching legacy isValidV34Data_endNodeIsEof (background.js:1985).
 */
export function validateOperationsLog(operations: readonly unknown[]): {
  valid: boolean;
  reason?: string;
  nodeCount?: number;
  saveTime?: number;
} {
  if (!operations || !Array.isArray(operations)) {
    return { valid: false, reason: 'Not an array' };
  }

  if (operations.length < 2) {
    return { valid: false, reason: 'Too few operations (need at least root + EOF)' };
  }

  const first = operations[0] as Record<string, unknown>;
  if (first['type'] !== DbOperationEnum.NODE_NEWROOT) {
    return { valid: false, reason: 'First operation is not NODE_NEWROOT' };
  }

  const last = operations[operations.length - 1] as Record<string, unknown>;
  if (last['type'] !== DbOperationEnum.EOF) {
    return { valid: false, reason: 'Last operation is not EOF' };
  }

  // Count node operations (root + inserts)
  let nodeCount = 0;
  for (const op of operations) {
    const opType = getOpType(op);
    if (
      opType === DbOperationEnum.NODE_NEWROOT ||
      opType === DbOperationEnum.NODE_INSERT
    ) {
      nodeCount++;
    }
  }

  return {
    valid: true,
    nodeCount,
    saveTime: (last as WireEofOp).time,
  };
}

/**
 * Convert an operations log → HierarchyJSO tree.
 *
 * Port of restoreTreeFromOperations (treemodel.js:2640-2671).
 * Returns null for empty operations (fresh install path, per background.js:1684).
 */
export function operationsToHierarchy(
  operations: readonly unknown[],
): HierarchyJSO | null {
  if (!operations || operations.length === 0) return null;

  // Build a mutable tree using path-based insertion
  let root: MutableHierarchy | null = null;

  for (const op of operations) {
    const opType = getOpType(op);
    const opNode = getOpNode(op);
    const opPath = getOpPath(op);

    if (opType === DbOperationEnum.NODE_NEWROOT && opNode) {
      root = { n: normalizeSerializedNode(opNode), s: [] };
    }

    if (opType === DbOperationEnum.NODE_INSERT && opNode && opPath && root) {
      insertByPath(root, opPath, normalizeSerializedNode(opNode));
    }
  }

  if (!root) return null;

  return freezeHierarchy(root);
}

/**
 * Convert a HierarchyJSO tree → operations log (wire format).
 *
 * Port of treemodel.js:821-848 (serializeHierarchyAsJSO is the format, but
 * the inverse operation reconstructs the operations log).
 */
export function hierarchyToOperations(hierarchy: HierarchyJSO): WireOperation[] {
  const ops: WireOperation[] = [];

  // Root operation
  ops.push({
    type: DbOperationEnum.NODE_NEWROOT,
    node: hierarchy.n as unknown as Record<string, unknown>,
  });

  // Recursive insert operations for all children
  if (hierarchy.s) {
    for (let i = 0; i < hierarchy.s.length; i++) {
      emitInserts(hierarchy.s[i], [i], ops);
    }
  }

  // EOF operation
  ops.push({ type: DbOperationEnum.EOF, time: Date.now() });

  return ops;
}

// -- Internal helpers --

interface MutableHierarchy {
  n: SerializedNode;
  s: MutableHierarchy[];
}

function getOpType(op: unknown): number {
  const obj = op as Record<string, unknown>;
  // Legacy used !!op['type'] which is falsy for 0 — fixed to use !== undefined
  if (obj['type'] !== undefined) return obj['type'] as number;
  if (Array.isArray(op)) return op[0] as number;
  return 0;
}

function getOpNode(op: unknown): Record<string, unknown> | null {
  const obj = op as Record<string, unknown>;
  if (obj['node'] !== undefined) return obj['node'] as Record<string, unknown>;
  if (Array.isArray(op) && op[1] !== undefined) return op[1] as Record<string, unknown>;
  return null;
}

function getOpPath(op: unknown): number[] | null {
  const obj = op as Record<string, unknown>;
  if (obj['path'] !== undefined) return obj['path'] as number[];
  if (Array.isArray(op) && op[2] !== undefined) return op[2] as number[];
  return null;
}

/**
 * Insert a node into the mutable hierarchy at the given path.
 *
 * Port of insertNodeByPathDuringDeserialize (treemodel.js:2660-2671).
 * Path indices walk subnodes arrays: all but last index navigate to the parent,
 * the last index is the insertion position.
 */
function insertByPath(
  root: MutableHierarchy,
  path: number[],
  node: SerializedNode,
): void {
  let container = root;

  // Navigate to parent (all indices except the last)
  for (let i = 0; i < path.length - 1; i++) {
    if (!container.s[path[i]]) return; // Corrupt path — skip silently
    container = container.s[path[i]];
  }

  const insertIdx = path[path.length - 1];
  const newChild: MutableHierarchy = { n: node, s: [] };

  // Insert at position (splice to maintain order)
  container.s.splice(insertIdx, 0, newChild);
}

/** Recursively emit NODE_INSERT operations for a subtree. */
function emitInserts(
  hierarchy: HierarchyJSO,
  path: number[],
  ops: WireOperation[],
): void {
  ops.push([
    DbOperationEnum.NODE_INSERT,
    hierarchy.n as unknown as Record<string, unknown>,
    path,
  ]);

  if (hierarchy.s) {
    for (let i = 0; i < hierarchy.s.length; i++) {
      emitInserts(hierarchy.s[i], [...path, i], ops);
    }
  }
}

/** Convert a mutable hierarchy to an immutable HierarchyJSO. */
function freezeHierarchy(mutable: MutableHierarchy): HierarchyJSO {
  const result: { n: SerializedNode; s?: HierarchyJSO[] } = { n: mutable.n };
  if (mutable.s.length > 0) {
    result.s = mutable.s.map(freezeHierarchy);
  }
  return result;
}
