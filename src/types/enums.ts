/**
 * Runtime enum constants for node types and database operations.
 *
 * Uses `as const` objects (not TS enums) to preserve exact string/number
 * values at runtime while deriving union types for compile-time checks.
 */

// -- Node types -----------------------------------------------------------------------

export const NodeTypesEnum = {
  TAB: 'tab',
  SAVEDTAB: 'savedtab',
  WAITINGTAB: 'waitingtab',
  ATTACHWAITINGTAB: 'attachwaitingtab',
  WINDOW: 'win',
  SAVEDWINDOW: 'savedwin',
  WAITINGWINDOW: 'waitingwin',
  SESSION: 'session',
  TEXTNOTE: 'textnote',
  SEPARATORLINE: 'separatorline',
  GROUP: 'group',
} as const;

/** Union of all node type string values */
export type NodeType = (typeof NodeTypesEnum)[keyof typeof NodeTypesEnum];

/**
 * Index-to-string mapping for serialization.
 *
 * WARNING: Order is a serialization contract with existing IndexedDB data.
 * DO NOT insert, reorder, or remove entries.
 *
 * Index 0 is reserved ('ZERO') because collapsed state is encoded as
 * negative type index.
 */
export const NODE_TYPE_NUM2STR: readonly string[] = [
  'ZERO', // 0 — reserved (collapsed = negative type index)
  NodeTypesEnum.SESSION, // 1
  NodeTypesEnum.TEXTNOTE, // 2
  NodeTypesEnum.SEPARATORLINE, // 3
  NodeTypesEnum.TAB, // 4
  NodeTypesEnum.SAVEDTAB, // 5
  NodeTypesEnum.GROUP, // 6
  NodeTypesEnum.WINDOW, // 7
  NodeTypesEnum.SAVEDWINDOW, // 8
  NodeTypesEnum.ATTACHWAITINGTAB, // 9
  NodeTypesEnum.WAITINGWINDOW, // 10
  NodeTypesEnum.WAITINGTAB, // 11
] as const;

/** String-to-index inverse mapping, computed from NODE_TYPE_NUM2STR */
export const NODE_TYPE_STR2NUM: Readonly<Record<string, number>> =
  NODE_TYPE_NUM2STR.reduce<Record<string, number>>((acc, val, idx) => {
    acc[val] = idx;
    return acc;
  }, {});

// -- Database operations --------------------------------------------------------------

export const DbOperationEnum = {
  TREE_CREATE: 1000,
  NODE_NEWROOT: 2000,
  NODE_INSERT: 2001,
  NODE_REPLACE: 2002,
  NODE_DELETE: 2003,
  NODE_MOVE: 2004,
  NODE_UPDATE_CHROME_OBJ_DATA: 3005,
  NODE_UPDATE_MARKS: 3006,
  LOG_ERROR: 9000,
  EOF: 11111,
} as const;

/** Union of all database operation numeric values */
export type DbOperation =
  (typeof DbOperationEnum)[keyof typeof DbOperationEnum];
