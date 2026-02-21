/**
 * Chrome storage.local read/write for HierarchyJSO tree data.
 *
 * Uses Epic 2's storageGet/storageSet wrappers from src/chrome/storage.ts.
 */

import { storageGet, storageSet } from '@/chrome/storage';
import { isValidHierarchyJSO } from '@/serialization/hierarchy-jso';
import type { HierarchyJSO } from '@/types/serialized';

const TREE_STORAGE_KEY = 'tabs_outliner_tree';

/** Load tree from chrome.storage.local. Returns null if not found or invalid. */
export async function loadTree(): Promise<HierarchyJSO | null> {
  const raw = await storageGet<unknown>('local', TREE_STORAGE_KEY, null);
  if (raw === null) return null;
  if (!isValidHierarchyJSO(raw)) return null;
  return raw;
}

/** Save tree to chrome.storage.local. */
export async function saveTree(hierarchy: HierarchyJSO): Promise<void> {
  await storageSet('local', { [TREE_STORAGE_KEY]: hierarchy });
}

/** Check if tree data exists in new storage. */
export async function treeExists(): Promise<boolean> {
  const raw = await storageGet<unknown>('local', TREE_STORAGE_KEY, null);
  return raw !== null;
}
