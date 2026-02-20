/**
 * EntryWireFormat ↔ SerializedNode codec.
 *
 * Port of frontendview.js:89-118 (decode) and treemodel.js:2154-2168 (encode).
 *
 * The entry wire format is a JSON-encoded tuple: [typeCode, data] or [typeCode, data, marks]
 * where typeCode is negative if the node is collapsed. The type code sign bit encodes
 * collapsed state.
 *
 * Note: marks normalization (mangled Closure Compiler field names) is NOT done here —
 * it happens in normalizeSerializedNode() in hierarchy-jso.ts.
 */

import { NODE_TYPE_NUM2STR, NODE_TYPE_STR2NUM } from '../types/enums';
import type { SerializedNode, EntryWireFormat } from '../types/serialized';
import type { NodeMarks } from '../types/marks';

/**
 * Decode an EntryWireFormat JSON string → SerializedNode.
 *
 * Port of frontendview.js deserializeEntry (the structural extraction part,
 * without the live node instantiation).
 */
export function decodeEntry(json: string): SerializedNode {
  const tuple = JSON.parse(json) as unknown[];

  const typeCode = tuple[0] as number;
  const data = tuple[1];
  const marks = tuple[2] as NodeMarks | undefined;

  // Fallback to savedtab for out-of-range or unknown type codes
  const typeStr = NODE_TYPE_NUM2STR[Math.abs(typeCode)] ?? 'savedtab';
  const collapsed = typeCode < 0;

  const node: Record<string, unknown> = {
    data,
  };

  // Only include type when not savedtab (default)
  if (typeStr !== 'savedtab') {
    node.type = typeStr;
  }

  if (collapsed) {
    node.colapsed = true;
  }

  if (marks) {
    node.marks = marks;
  }

  return node as unknown as SerializedNode;
}

/**
 * Encode a SerializedNode → EntryWireFormat tuple.
 *
 * Port of treemodel.js serializeNodeBodyContent_forDiff.
 * The type code is negative if collapsed.
 */
export function encodeEntry(node: SerializedNode): EntryWireFormat {
  const typeStr = node.type ?? 'savedtab';
  const typeNum = NODE_TYPE_STR2NUM[typeStr];
  const typeCode = typeNum * (node.colapsed ? -1 : 1);

  if (node.marks) {
    return [typeCode, node.data, node.marks];
  }

  return [typeCode, node.data];
}
