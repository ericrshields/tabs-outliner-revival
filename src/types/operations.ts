/**
 * Operation log entry types for IndexedDB persistence.
 *
 * Each operation wraps its opType + schema version + opData.
 * The types here represent the `data` property of each operation class.
 */

import type { DbOperationEnum } from './enums';
import type { NodeMarks } from './marks';
import type { SerializedNode } from './serialized';

/** Base shape for all operation log entries */
interface OperationBase<T extends number, D = Record<string, never>> {
  readonly opType: T;
  readonly opSchemeVersion: number;
  readonly opData: D;
}

export type Op_TreeCreate = OperationBase<typeof DbOperationEnum.TREE_CREATE>;

export type Op_NodeNewRoot = OperationBase<
  typeof DbOperationEnum.NODE_NEWROOT,
  { readonly node: SerializedNode }
>;

export type Op_NodeInsert = OperationBase<
  typeof DbOperationEnum.NODE_INSERT,
  {
    readonly targetPath: number[];
    readonly nodeData: SerializedNode;
  }
>;

export type Op_NodeReplace = OperationBase<
  typeof DbOperationEnum.NODE_REPLACE,
  {
    readonly targetPath: number[];
    readonly nodeData: SerializedNode;
  }
>;

export type Op_NodeDelete = OperationBase<
  typeof DbOperationEnum.NODE_DELETE,
  { readonly targetPath: number[] }
>;

/**
 * NODE_MOVE exists in the legacy enum but was never implemented.
 * The legacy comment reads: "такого у нас пока нет" (we don't have this yet).
 * Shape is a placeholder — will be defined when move operations are built.
 */
export type Op_NodeMove = OperationBase<
  typeof DbOperationEnum.NODE_MOVE,
  Record<string, never>
>;

export type Op_NodeUpdateChromeObjData = OperationBase<
  typeof DbOperationEnum.NODE_UPDATE_CHROME_OBJ_DATA,
  {
    readonly targetPath: number[];
    readonly data: unknown;
  }
>;

export type Op_NodeUpdateMarks = OperationBase<
  typeof DbOperationEnum.NODE_UPDATE_MARKS,
  {
    readonly targetPath: number[];
    readonly marks: NodeMarks;
  }
>;

export type Op_LogError = OperationBase<
  typeof DbOperationEnum.LOG_ERROR,
  { readonly error: unknown }
>;

export type Op_EOF = OperationBase<
  typeof DbOperationEnum.EOF,
  { readonly time: number }
>;

/** Discriminated union of all operation log entries */
export type OperationLogEntry =
  | Op_TreeCreate
  | Op_NodeNewRoot
  | Op_NodeInsert
  | Op_NodeReplace
  | Op_NodeDelete
  | Op_NodeMove
  | Op_NodeUpdateChromeObjData
  | Op_NodeUpdateMarks
  | Op_LogError
  | Op_EOF;
