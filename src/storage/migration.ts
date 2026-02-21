/**
 * Migration orchestrator: read legacy IndexedDB → convert to HierarchyJSO → write to chrome.storage.local.
 *
 * Flow:
 * 1. If new storage already has data → skip ('new-storage')
 * 2. Try V34 IndexedDB → validate → convert → write → verify round-trip
 * 3. If V34 fails, try V33 → same flow
 * 4. If neither exists → return 'fresh-install'
 * 5. Legacy IndexedDB is NEVER deleted — remains as fallback
 */

import { readLegacyDB, legacyDbExists, DB_V34, DB_V33 } from './indexeddb-reader';
import { loadTree, saveTree, treeExists } from './tree-storage';
import {
  validateOperationsLog,
  operationsToHierarchy,
} from '@/serialization/operations-codec';
import { countNodes, hierarchiesEqual } from '@/serialization/hierarchy-jso';
import type { LegacyDbConfig } from './indexeddb-reader';

export interface MigrationResult {
  readonly success: boolean;
  readonly source:
    | 'indexeddb-v34'
    | 'indexeddb-v33'
    | 'new-storage'
    | 'fresh-install';
  readonly nodeCount: number;
  readonly errors: string[];
}

/** Check if migration is needed (no tree in new storage). */
export async function isMigrationNeeded(): Promise<boolean> {
  return !(await treeExists());
}

/** Full migration: read legacy → convert → write new → validate round-trip. */
export async function migrateFromLegacy(): Promise<MigrationResult> {
  const errors: string[] = [];

  // Step 1: Check if new storage already has data
  if (await treeExists()) {
    const existing = await loadTree();
    return {
      success: true,
      source: 'new-storage',
      nodeCount: existing ? countNodes(existing) : 0,
      errors: [],
    };
  }

  // Step 2: Try V34
  const v34Result = await tryMigrateFromDB(DB_V34, 'indexeddb-v34', errors);
  if (v34Result) return v34Result;

  // Step 3: Try V33
  const v33Result = await tryMigrateFromDB(DB_V33, 'indexeddb-v33', errors);
  if (v33Result) return v33Result;

  // Step 4: Fresh install
  return {
    success: true,
    source: 'fresh-install',
    nodeCount: 0,
    errors,
  };
}

async function tryMigrateFromDB(
  config: LegacyDbConfig,
  source: 'indexeddb-v34' | 'indexeddb-v33',
  errors: string[],
): Promise<MigrationResult | null> {
  try {
    // Check if DB exists
    const exists = await legacyDbExists(config);
    if (!exists) return null;

    // Read operations data
    const operations = await readLegacyDB(config);
    if (!operations || operations.length === 0) {
      errors.push(`${source}: database exists but no operations data found`);
      return null;
    }

    // Validate operations log
    const validation = validateOperationsLog(operations);
    if (!validation.valid) {
      errors.push(`${source}: invalid operations log — ${validation.reason}`);
      return null;
    }

    // Convert to HierarchyJSO
    const hierarchy = operationsToHierarchy(operations);
    if (!hierarchy) {
      errors.push(`${source}: failed to convert operations to hierarchy`);
      return null;
    }

    const nodeCount = countNodes(hierarchy);

    // Write to new storage
    await saveTree(hierarchy);

    // Verify round-trip
    const reloaded = await loadTree();
    if (!reloaded) {
      errors.push(`${source}: round-trip verification failed — could not reload saved tree`);
      return {
        success: false,
        source,
        nodeCount,
        errors,
      };
    }

    if (!hierarchiesEqual(hierarchy, reloaded)) {
      errors.push(`${source}: round-trip verification failed — trees differ after save/load`);
      return {
        success: false,
        source,
        nodeCount,
        errors,
      };
    }

    return {
      success: true,
      source,
      nodeCount,
      errors,
    };
  } catch (err) {
    errors.push(`${source}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
