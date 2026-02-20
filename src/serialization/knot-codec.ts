/**
 * Subnodes diff codec: serialize/restore/compare subnodes arrays.
 *
 * Direct port of treemodel.js:160-234. The serialize/restore pair must be
 * exact inverses — verified by the fuzz test ported from legacy
 * testSubnodesChangesAlgorithm().
 *
 * Delta operations (pipe-separated):
 *   "*"  or "*N"  — use N elements from base array (default N=1)
 *   "-"  or "-N"  — skip N elements from base, then use next
 *   raw DID string — new element not in base
 */

import { s2i36 } from './base36';
import {
  OPS_SEPARATOR,
  CDID_SUBNODESLIST_SEPARATOR,
  SUBNODES_DIDS_SEPARATOR,
} from './constants';

/**
 * Parse the count suffix from a delta operation string (e.g., "*3" → 3, "-" → 1).
 * Returns 1 for missing/invalid suffixes, matching legacy NaN→1 fallback.
 */
function parseOpCount(op: string, prefix: string): number {
  let n = s2i36(op.split(prefix)[1]);
  if (isNaN(n)) n = 1;
  return n;
}

/** Check if current subnodes differ from base. */
export function isChangesToBase(
  current: readonly string[],
  base: readonly string[],
): boolean {
  if (current.length !== base.length) return true;
  for (let i = 0; i < current.length; i++) {
    if (current[i] !== base[i]) return true;
  }
  return false;
}

/**
 * Serialize current subnodes as a delta against the base array.
 *
 * Port of SybnodesChangesMonitor_serializeCurSubnodes (treemodel.js:171-205).
 */
export function serializeCurSubnodes(
  current: readonly string[],
  base: readonly string[],
): string {
  let lastFoundDidInBasePos = -1;
  const diff: string[] = [];

  for (let curCursor = 0; curCursor < current.length; curCursor++) {
    const si = base.indexOf(current[curCursor], lastFoundDidInBasePos + 1);

    if (si < 0) {
      // New DID not in base
      diff.push(current[curCursor]);
    } else {
      // Found in base
      if (lastFoundDidInBasePos + 1 === si) {
        // Consecutive — merge into "*N" use-ops
        const lastOp = diff.length > 0 ? diff[diff.length - 1] : undefined;
        if (lastOp !== undefined && lastOp[0] === '*') {
          diff.pop();
          const n = parseOpCount(lastOp, '*');
          diff.push('*' + (n + 1).toString(36));
        } else {
          diff.push('*');
        }
      } else {
        // Gap — encode as skip
        const n = si - (lastFoundDidInBasePos + 1);
        if (n === 1) {
          diff.push('-');
        } else {
          diff.push('-' + n.toString(36));
        }
      }

      lastFoundDidInBasePos = si;
    }
  }

  return diff.join(OPS_SEPARATOR);
}

/**
 * Restore subnodes list by applying delta to base array.
 *
 * Port of SybnodesChangesMonitor_restoreSubnodesList (treemodel.js:207-231).
 * Includes bounds check on baseCursor to prevent undefined pushes on corrupt data.
 */
export function restoreSubnodesList(
  base: readonly string[],
  changesStr: string,
): string[] {
  if (changesStr === '') return [];
  const diff = changesStr.split(OPS_SEPARATOR);
  let baseCursor = 0;
  const result: string[] = [];

  for (let i = 0; i < diff.length; i++) {
    const op = diff[i];

    if (op[0] === '*') {
      // Use N consecutive elements from base
      let n = parseOpCount(op, '*');
      while (n-- > 0 && baseCursor < base.length) {
        result.push(base[baseCursor++]);
      }
    } else if (op[0] === '-') {
      // Skip N elements from base, then use the next one.
      // The implicit "use next" is part of the wire protocol — the encoder
      // emits "-N" when it finds a match after a gap, encoding both the
      // skip and the matched element in a single operation.
      const n = parseOpCount(op, '-');
      baseCursor += n;
      if (baseCursor < base.length) {
        result.push(base[baseCursor++]);
      }
    } else {
      // Raw DID — new element
      result.push(op);
    }
  }

  return result;
}

/**
 * Extract base subnodes array from a knot string "cdid@did&did&did".
 *
 * Port of getBaseSubnodesArray (treemodel.js:233-234).
 */
export function getBaseSubnodesArray(baseKnot: string): string[] {
  const parts = baseKnot.split(CDID_SUBNODESLIST_SEPARATOR);
  if (parts.length < 2) return [];
  return parts[1].split(SUBNODES_DIDS_SEPARATOR);
}
