/**
 * NodeMarks — custom visual marks attached to a tree node.
 *
 * The marks object is treated as immutable in the legacy code:
 * relicons and marks are always replaced together, never mutated in place.
 */

import type { TileObj } from './tile';

export interface NodeMarks {
  readonly relicons: readonly TileObj[];
  readonly customTitle?: string;
  readonly customFavicon?: string;
  readonly customColorActive?: string;
  readonly customColorSaved?: string;
}
