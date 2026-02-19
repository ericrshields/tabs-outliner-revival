/**
 * Serialized wire formats for nodes and tree hierarchies.
 *
 * These types represent the JSON shapes stored in IndexedDB and
 * exchanged via the TabsOutliner interchange format.
 */

import type { NodeType } from './enums';
import type { NodeMarks } from './marks';

/**
 * Serialized form of a single node.
 *
 * - `type` is omitted when the node is a SAVEDTAB (the most common type,
 *    stripped for space savings)
 * - `marks` is omitted when empty (only relicons present and relicons is [])
 * - `colapsed` is omitted when false
 */
export interface SerializedNode {
  /** Node type — absent means 'savedtab' */
  readonly type?: Exclude<NodeType, 'savedtab'>;
  /** Node difference ID */
  readonly dId?: number;
  /** Content difference ID */
  readonly cdId?: number;
  /** Subnodes difference ID */
  readonly sdId?: number;
  /** Serialized knot for subnodes diff base */
  readonly sdIdKnot?: string;
  /** Custom marks — omitted when empty */
  readonly marks?: NodeMarks;
  /** Collapsed state — omitted when false */
  readonly colapsed?: boolean;
  /** Polymorphic node data (shape depends on type) */
  readonly data: unknown;
}

/**
 * Recursive hierarchy JSO (JavaScript Object) format.
 *
 * Used for full tree serialization and the TabsOutliner interchange format.
 * - `n` is the serialized node
 * - `s` is an optional array of child hierarchies
 */
export interface HierarchyJSO {
  readonly n: SerializedNode;
  readonly s?: HierarchyJSO[];
}

/**
 * Entry wire format used in diff serialization.
 *
 * Encoded as a tuple: [typeCode, data] or [typeCode, data, marks]
 * where typeCode is negative if collapsed.
 */
export type EntryWireFormat =
  | readonly [typeCode: number, data: unknown]
  | readonly [typeCode: number, data: unknown, marks: NodeMarks];
