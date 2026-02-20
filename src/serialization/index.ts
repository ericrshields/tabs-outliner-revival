export { i2s36, s2i36 } from './base36';

export {
  CDID_SDID_SEPARATOR,
  CDID_SUBNODESLIST_SEPARATOR,
  OPS_SEPARATOR,
  SUBNODES_DIDS_SEPARATOR,
  OPS_COMPONENTS_SEPARATOR,
  NEW_DIDS_SEPARATOR,
} from './constants';

export { decodeEntry, encodeEntry } from './entry-codec';

export {
  isChangesToBase,
  serializeCurSubnodes,
  restoreSubnodesList,
  getBaseSubnodesArray,
} from './knot-codec';

export {
  isValidHierarchyJSO,
  normalizeSerializedNode,
  countNodes,
  hierarchiesEqual,
  importTreeFile,
  exportTreeFile,
} from './hierarchy-jso';

export {
  validateOperationsLog,
  operationsToHierarchy,
  hierarchyToOperations,
} from './operations-codec';
export type { WireRootOp, WireInsertOp, WireEofOp, WireOperation } from './operations-codec';

export { resolveKnotsToHierarchy } from './knot-resolver';
export type { DiffSnapshot } from './knot-resolver';
