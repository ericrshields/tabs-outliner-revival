/**
 * Adapters between NodeDTO and react-arborist's data expectations.
 *
 * react-arborist needs `idAccessor` and `childrenAccessor` props.
 * These functions let us pass NodeDTO[] directly without transformation.
 */

import type { NodeDTO } from '@/types/node-dto';

/** idAccessor for react-arborist — extracts the MVC ID string. */
export function nodeId(dto: NodeDTO): string {
  return dto.idMVC;
}

/**
 * childrenAccessor for react-arborist.
 *
 * Returns subnodes array (possibly empty) if the node has children,
 * null for true leaf nodes.
 *
 * Key distinction: collapsed nodes have `subnodes: []` but
 * `isSubnodesPresent: true`. Return `[]` (not `null`) so
 * react-arborist shows the expand arrow. Return `null` only for
 * true leaf nodes where `isSubnodesPresent` is false.
 */
export function nodeChildren(dto: NodeDTO): readonly NodeDTO[] | null {
  if (dto.isSubnodesPresent || dto.subnodes.length > 0) {
    return dto.subnodes;
  }
  return null;
}

/**
 * Build an open/close state map from a NodeDTO tree for react-arborist's
 * `initialOpenState` prop.
 *
 * Walks the tree recursively. Nodes with `isSubnodesPresent: true` are
 * included in the map: open if not collapsed, closed if collapsed.
 * Leaf nodes are omitted (react-arborist ignores them).
 */
export function buildOpenMap(root: NodeDTO): Record<string, boolean> {
  const map: Record<string, boolean> = {};

  function walk(node: NodeDTO): void {
    if (node.isSubnodesPresent || node.subnodes.length > 0) {
      map[node.idMVC] = !node.colapsed;
    }
    for (const child of node.subnodes) {
      walk(child);
    }
  }

  walk(root);
  return map;
}
