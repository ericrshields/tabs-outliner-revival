/**
 * Recursive knot resolution: DiffSnapshot → HierarchyJSO.
 *
 * Port of frontendview.js:9-66 (getKnotSubnodes, restoreTreeStructure, deserializeKnot).
 *
 * Knot content encoding (4 variants):
 *   1. "cdId"                     — no subnodes
 *   2. "cdId@dId&dId&dId"         — inline subnodes
 *   3. "cdId#sdId"                — reference to base knot (recursive)
 *   4. "cdId#sdId#deltaOps"       — reference + delta operations
 */

import { NodeTypesEnum } from '../types/enums';
import { restoreSubnodesList } from './knot-codec';
import { decodeEntry } from './entry-codec';
import { normalizeSerializedNode } from './hierarchy-jso';
import type { SerializedNode, HierarchyJSO } from '../types/serialized';

export interface DiffSnapshot {
  readonly rootDid: string;
  readonly allKnots: ReadonlyMap<string, string>; // dId → knot string
  readonly entries: ReadonlyMap<string, string>; // cdId → JSON(EntryWireFormat)
}

/**
 * Resolve a diff snapshot into a HierarchyJSO tree.
 *
 * Port of restoreTreeStructure + deserializeKnot (frontendview.js:43-86).
 * Includes cycle detection via a visited set to prevent infinite recursion.
 */
export function resolveKnotsToHierarchy(snapshot: DiffSnapshot): HierarchyJSO {
  return resolveNode(snapshot, snapshot.rootDid, new Set(), new Set());
}

// -- Internal helpers --

function resolveNode(
  snapshot: DiffSnapshot,
  dId: string,
  visited: Set<string>,
  knotVisited: Set<string>,
): HierarchyJSO {
  if (visited.has(dId)) {
    // Cycle detected — return a placeholder text note
    return {
      n: {
        type: NodeTypesEnum.TEXTNOTE,
        data: { note: '[CYCLE DETECTED in tree structure]' },
      },
    };
  }
  visited.add(dId);

  const knotContent = snapshot.allKnots.get(dId) ?? '';
  const knotData = getKnotSubnodes(dId, knotContent, snapshot.allKnots, knotVisited);
  const subnodesDIds = knotData.subnodesDids;
  const cdId = knotData.cdId;

  // Build node data
  const node = deserializeKnot(snapshot, dId, cdId);

  // Recursively resolve children
  const children: HierarchyJSO[] = [];
  for (const childDId of subnodesDIds) {
    children.push(resolveNode(snapshot, childDId, visited, knotVisited));
  }

  const result: { n: SerializedNode; s?: HierarchyJSO[] } = { n: node };
  if (children.length > 0) {
    result.s = children;
  }

  return result;
}

interface KnotSubnodesResult {
  subnodesDids: string[];
  cdId: string;
}

/**
 * Parse a knot string to extract subnodes DIDs and the cdId.
 *
 * Port of getKnotSubnodes (frontendview.js:9-40).
 */
function getKnotSubnodes(
  knotDidStr: string,
  knotContent: string,
  allKnots: ReadonlyMap<string, string>,
  visitedKnots: Set<string>,
): KnotSubnodesResult {
  if (visitedKnots.has(knotDidStr)) {
    // Cycle in knot base-reference chain — break recursion
    return { subnodesDids: [], cdId: knotContent.split('#')[0] || knotContent };
  }
  visitedKnots.add(knotDidStr);

  try {
    const didSubnodes = knotContent.split('@');

    // Variant 2: "cdId@dId&dId&dId" — inline subnodes
    if (didSubnodes.length === 2) {
      return {
        subnodesDids: didSubnodes[1].split('&'),
        cdId: didSubnodes[0],
      };
    }

    const parts = knotContent.split('#');
    const cdId = parts[0];

    // Variant 1: "cdId" — no subnodes
    if (didSubnodes.length === 1 && parts.length === 1) {
      return { subnodesDids: [], cdId };
    }

    let subnodesDids: string[] = [];

    // Variant 3 or 4: "cdId#sdId" or "cdId#sdId#deltaOps"
    if (parts.length >= 2) {
      const subnodesBaseKnotDid = parts[1];
      const subnodesBaseKnotContent = allKnots.get(subnodesBaseKnotDid) ?? '';

      // Recursive resolution of base knot (pass visitedKnots for cycle detection)
      const baseResult = getKnotSubnodes(
        subnodesBaseKnotDid,
        subnodesBaseKnotContent,
        allKnots,
        visitedKnots,
      );
      subnodesDids = baseResult.subnodesDids;
    }

    // Variant 4: apply delta operations
    if (parts.length === 3) {
      subnodesDids = restoreSubnodesList(subnodesDids, parts[2]);
    }

    return { subnodesDids, cdId };
  } catch (err) {
    console.warn('[Tabs Outliner] Error parsing knot subnodes:', err);
    return { subnodesDids: [], cdId: knotContent.split('#')[0] || knotContent };
  }
}

/**
 * Build a SerializedNode from a knot.
 *
 * Port of deserializeKnot (frontendview.js:68-86).
 * For the root node, creates a SESSION node.
 * For other nodes, uses entry data if available, otherwise creates a TEXTNOTE placeholder.
 */
function deserializeKnot(
  snapshot: DiffSnapshot,
  dId: string,
  cdId: string,
): SerializedNode {
  if (dId === snapshot.rootDid) {
    // Root node → session
    return normalizeSerializedNode({
      type: NodeTypesEnum.SESSION,
      data: { treeId: 'none', nextDId: 0 },
      dId: parseInt(dId, 36) || undefined,
      cdId: parseInt(cdId, 36) || undefined,
    });
  }

  // Non-root: use entry data if available
  const entryJson = snapshot.entries.get(cdId);
  if (entryJson) {
    const decoded = decodeEntry(entryJson);
    // Merge diff IDs into the decoded node
    const raw: Record<string, unknown> = { ...(decoded as unknown as Record<string, unknown>) };
    raw.dId = parseInt(dId, 36) || undefined;
    raw.cdId = parseInt(cdId, 36) || undefined;
    return normalizeSerializedNode(raw);
  }

  // No entry found — placeholder text note (matches legacy fallback behavior)
  console.warn('[Tabs Outliner] Missing entry for cdId:', cdId);
  return normalizeSerializedNode({
    type: NodeTypesEnum.TEXTNOTE,
    data: { note: '[No content available]' },
    dId: parseInt(dId, 36) || undefined,
    cdId: parseInt(cdId, 36) || undefined,
  });
}
