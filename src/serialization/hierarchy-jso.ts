/**
 * HierarchyJSO validation, normalization, node counting, comparison,
 * and .tree file import/export.
 */

import { NODE_TYPE_NUM2STR } from '@/types/enums';
import type { SerializedNode, HierarchyJSO } from '@/types/serialized';
import type { NodeMarks } from '@/types/marks';

/**
 * Validate that a parsed JSON value conforms to the HierarchyJSO shape.
 *
 * Checks recursive structure: each node must have `n` with `data`,
 * and optional `s` array of child hierarchies.
 */
export function isValidHierarchyJSO(value: unknown): value is HierarchyJSO {
  if (value === null || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  if (!obj.n || typeof obj.n !== 'object') return false;

  const node = obj.n as Record<string, unknown>;
  if (!('data' in node)) return false;

  // Validate type if present
  if (node.type !== undefined) {
    if (typeof node.type !== 'string') return false;
    if (!NODE_TYPE_NUM2STR.includes(node.type) || node.type === 'ZERO') {
      return false;
    }
  }

  // Validate subnodes recursively
  if (obj.s !== undefined) {
    if (!Array.isArray(obj.s)) return false;
    for (const child of obj.s) {
      if (!isValidHierarchyJSO(child)) return false;
    }
  }

  return true;
}

/**
 * Normalize a raw SerializedNode by applying:
 * 1. Default type: absent type → 'savedtab'
 * 2. Marks normalization: Closure Compiler mangled field names from v0.4.27-0.4.28
 *
 * Port of treemodel.js deserializeMarksAndCollapsed (marks normalization section).
 * Must be idempotent.
 */
export function normalizeSerializedNode(
  raw: Record<string, unknown>,
): SerializedNode {
  const result: Record<string, unknown> = { ...raw };

  // Normalize marks (Closure Compiler mangled names from v0.4.27-0.4.28)
  if (result.marks && typeof result.marks === 'object') {
    const marks = { ...(result.marks as Record<string, unknown>) };

    // v0.4.28: U → customColorActive
    if (marks['U']) {
      marks.customColorActive = marks['U'];
      delete marks['U'];
    }
    // v0.4.28: V → customColorSaved
    if (marks['V']) {
      marks.customColorSaved = marks['V'];
      delete marks['V'];
    }
    // v0.4.27: J → customTitle
    if (marks['J']) {
      marks.customTitle = marks['J'];
      delete marks['J'];
    }
    // v0.4.27: u → customFavicon
    if (marks['u']) {
      marks.customFavicon = marks['u'];
      delete marks['u'];
    }
    // v0.4.28: W → customTitle (overrides J if both present)
    if (marks['W']) {
      marks.customTitle = marks['W'];
      delete marks['W'];
    }
    // v0.4.28: I → customFavicon (overrides u if both present)
    if (marks['I']) {
      marks.customFavicon = marks['I'];
      delete marks['I'];
    }

    // Ensure relicons is always a proper array (handles missing, null, non-array)
    if (!Array.isArray(marks.relicons)) {
      marks.relicons = [];
    } else {
      marks.relicons = [...(marks.relicons as unknown[])];
    }

    result.marks = marks as unknown as NodeMarks;
  }

  return result as unknown as SerializedNode;
}

/** Count all nodes in a HierarchyJSO tree. */
export function countNodes(hierarchy: HierarchyJSO): number {
  let count = 1;
  if (hierarchy.s) {
    for (const child of hierarchy.s) {
      count += countNodes(child);
    }
  }
  return count;
}

/** Deep-compare two HierarchyJSO trees for migration validation. */
export function hierarchiesEqual(a: HierarchyJSO, b: HierarchyJSO): boolean {
  // Compare nodes via JSON (order-independent for objects)
  if (JSON.stringify(a.n) !== JSON.stringify(b.n)) return false;

  const aChildren = a.s ?? [];
  const bChildren = b.s ?? [];

  if (aChildren.length !== bChildren.length) return false;

  for (let i = 0; i < aChildren.length; i++) {
    if (!hierarchiesEqual(aChildren[i], bChildren[i])) return false;
  }

  return true;
}

/** Parse a .tree file JSON string → HierarchyJSO. Throws on invalid input. */
export function importTreeFile(json: string): HierarchyJSO {
  const parsed: unknown = JSON.parse(json);
  if (!isValidHierarchyJSO(parsed)) {
    throw new Error('Invalid .tree file: does not conform to HierarchyJSO shape');
  }
  return parsed;
}

/** Serialize a HierarchyJSO → .tree file JSON string. */
export function exportTreeFile(hierarchy: HierarchyJSO): string {
  return JSON.stringify(hierarchy);
}
