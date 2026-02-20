/**
 * Separator characters used in the diff serialization wire format.
 *
 * Port of treemodel.js:110-117. These are serialization contracts —
 * changing any value breaks compatibility with existing data.
 */

/** Separates cdId from sdId in knot strings: "cdId#sdId" */
export const CDID_SDID_SEPARATOR = '#';

/** Separates cdId from inline subnodes list: "cdId@dId&dId&dId" */
export const CDID_SUBNODESLIST_SEPARATOR = '@';

/** Separates individual delta operations in a changes string */
export const OPS_SEPARATOR = '|';

/** Separates DID entries in a subnodes list */
export const SUBNODES_DIDS_SEPARATOR = '&';

/** Separates components within a single delta operation */
export const OPS_COMPONENTS_SEPARATOR = '=';

/** Separates new DID entries */
export const NEW_DIDS_SEPARATOR = '/';
