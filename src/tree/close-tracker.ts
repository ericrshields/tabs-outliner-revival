/**
 * CloseTracker — tracks recently closed tabs for undo-close (F3).
 *
 * Records the tab data and tree position when active tabs are removed.
 * Epic 5 queries this when chrome.tabs.onCreated fires to detect
 * Ctrl+Shift+T undo operations and restore the tab at its original position.
 *
 * Uses a bounded circular buffer with configurable max entries.
 */

import type { TabData } from '../types/node-data';
import type { MvcId } from '../types/brands';
import { TreeNode } from './tree-node';

export interface CloseRecord {
  readonly tabData: TabData;
  readonly parentMvcId: MvcId;
  readonly siblingIndex: number;
  readonly timestamp: number;
}

export class CloseTracker {
  private readonly records: CloseRecord[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
  }

  /**
   * Track a node being removed from the tree.
   *
   * IMPORTANT: Must be called BEFORE the node is detached from its parent,
   * since this reads `node.parent` and the sibling index.
   */
  track(node: TreeNode): void {
    if (!node.parent) return;

    const tabData = node.data as TabData;
    if (!tabData) return;

    const parentMvcId = node.parent.idMVC;
    const siblingIndex = node.parent.subnodes.indexOf(node);

    const record: CloseRecord = {
      tabData,
      parentMvcId,
      siblingIndex,
      timestamp: Date.now(),
    };

    this.records.push(record);

    // Trim to max entries
    while (this.records.length > this.maxEntries) {
      this.records.shift();
    }
  }

  /** Find a close record by Chrome tab ID. */
  findByTabId(tabId: number): CloseRecord | null {
    // Search newest first
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].tabData.id === tabId) {
        return this.records[i];
      }
    }
    return null;
  }

  /** Find a close record by URL. */
  findByUrl(url: string): CloseRecord | null {
    // Search newest first
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].tabData.url === url) {
        return this.records[i];
      }
    }
    return null;
  }

  clear(): void {
    this.records.length = 0;
  }

  get size(): number {
    return this.records.length;
  }
}
