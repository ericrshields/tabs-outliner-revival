/**
 * Base-36 integer encoding utilities.
 *
 * Port of treemodel.js:42-48. Used throughout the diff serialization
 * system for compact integer representation (DiffId strings, delta ops).
 */

/** Encode a non-negative integer as a base-36 string. */
export function i2s36(v: number): string {
  return v.toString(36);
}

/**
 * Decode a base-36 string back to a number.
 *
 * Returns `NaN` for invalid input — this behavior is intentional.
 * Legacy code checks `if(isNaN(n)) n = 1` in delta operations.
 */
export function s2i36(v: string): number {
  return parseInt(v, 36);
}
