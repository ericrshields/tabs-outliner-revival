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
 * All nodes can be containers — matches original extension behavior
 * where any node can have subnodes (e.g., tabs with notes underneath).
 * Returns the subnodes array (possibly empty) so react-arborist treats
 * every node as an internal (droppable) node. Arrow visibility is
 * controlled in NodeRow based on actual subnode presence, not
 * react-arborist's isInternal.
 */
export function nodeChildren(dto: NodeDTO): readonly NodeDTO[] | null {
  return dto.subnodes;
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
