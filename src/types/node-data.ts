/**
 * Per-type data payloads stored in each node's `persistentData` / `data` field.
 *
 * These map to the `polymorficSerializeData()` output for each node type.
 */

import type { ChromeTabData, ChromeWindowData } from './chrome';

export interface SessionData {
  readonly treeId: string;
  readonly nextDId: number;
  readonly nonDumpedDId: number;
}

export interface TextNoteData {
  readonly note: string;
}

export interface SeparatorData {
  readonly separatorIndx: 0 | 1 | 2;
}

/** Tab data is the serialized subset of a Chrome tab */
export type TabData = ChromeTabData;

/** Window data is the serialized subset of a Chrome window */
export type WindowData = ChromeWindowData;

/** Group nodes have no persistent data beyond marks/collapsed */
export type GroupData = null;
