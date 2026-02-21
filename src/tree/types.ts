/**
 * Tree mutation result types and listener interfaces.
 *
 * These types define the contract between the TreeModel and its consumers
 * (Epic 5 ActiveSession, Epic 6 state sync). Mutations return a result
 * describing what changed; an optional listener receives each result.
 */

import type { MvcId } from '../types/brands';
import type { ParentsUpdateData } from '../types/node-dto';

export interface TreeMutationResult {
  readonly type:
    | 'insert'
    | 'delete'
    | 'move'
    | 'collapse'
    | 'update'
    | 'replace';
  readonly affectedNodeId: MvcId;
  readonly parentUpdates: ParentsUpdateData;
  readonly deletedNodeIds?: MvcId[];
  readonly cursorSuggestion?: MvcId;
}

export type MutationListener = (result: TreeMutationResult) => void;

export interface TreeModelOptions {
  readonly onMutation?: MutationListener;
}

/**
 * Accumulated diff data for incremental serialization (Epic 5 consumption).
 *
 * Map keys are DiffIdStr values (base-36 encoded DiffIds), kept as plain
 * strings for Map compatibility — branded types can't be Map keys ergonomically.
 */
export interface DiffAccumulator {
  readonly allKnots: Map<string, string>;
  readonly entries: Map<string, string>;
  readonly rootDid: string;
}
