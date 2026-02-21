/**
 * MvcId generator — produces unique communication IDs for tree nodes.
 *
 * Format: "idmvc" + monotonically increasing counter.
 * MvcIds are ephemeral (not persisted), used only for background-view communication.
 */

import type { MvcId } from '@/types/brands';

let counter = 1;

/** Generate a unique MvcId for a new tree node. */
export function generateMvcId(): MvcId {
  return ('idmvc' + counter++) as MvcId;
}

/** Reset the counter (testing only). */
export function resetMvcIdCounter(value: number = 1): void {
  counter = value;
}
