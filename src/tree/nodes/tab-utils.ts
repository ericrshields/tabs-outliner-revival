/**
 * Shared tab/window serialization helpers.
 *
 * Extracts the serialization logic shared between tab and window node variants
 * without introducing an inheritance layer.
 */

import type { TabData, WindowData } from '../../types/node-data';

/** Serialize tab data, stripping runtime-only and default-value fields. */
export function serializeTabData(data: TabData): TabData {
  const r = { ...data } as Record<string, unknown>;
  if (r.status === 'complete') delete r.status;
  if (!r.pinned) delete r.pinned;
  if (!r.incognito) delete r.incognito;
  if (!r.active) delete r.active;
  if (!r.highlighted) delete r.highlighted;
  // Remove deprecated/runtime-only fields
  delete r.selected;
  delete r.height;
  delete r.width;
  delete r.index;
  return r as TabData;
}

/** Serialize window data, stripping runtime-only and default-value fields. */
export function serializeWindowData(data: WindowData): WindowData {
  const r = { ...data } as Record<string, unknown>;
  if (!r.incognito) delete r.incognito;
  if (!r.alwaysOnTop) delete r.alwaysOnTop;
  if (!r.focused) delete r.focused;
  // Remove runtime-only fields
  delete r.tabs;
  return r as WindowData;
}
