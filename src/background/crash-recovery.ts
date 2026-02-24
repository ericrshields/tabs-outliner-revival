/**
 * Crash recovery — correlate persisted tree with live Chrome state.
 *
 * On startup, the persisted tree may reference Chrome windows/tabs
 * that no longer exist (browser crash, Chrome update, etc.). This
 * module walks the tree and:
 * 1. Converts active nodes whose Chrome entity no longer exists → saved
 * 2. Creates new nodes for Chrome windows/tabs not in the tree
 */

import type { TreeModel } from '@/tree/tree-model';
import { TreeNode } from '@/tree/tree-node';
import { NodeTypesEnum } from '@/types/enums';
import type { TabData, WindowData } from '@/types/node-data';
import type { ChromeTabData, ChromeWindowData } from '@/types/chrome';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { queryWindows } from '@/chrome/windows';
import { queryTabs } from '@/chrome/tabs';

export interface RecoveryResult {
  readonly recoveredCount: number;
  readonly newCount: number;
}

/**
 * Correlate persisted tree with current Chrome state.
 *
 * - Active nodes whose Chrome tab/window no longer exists → convert to saved
 * - Chrome tabs/windows with no tree node → create new nodes
 */
export async function synchronizeTreeWithChrome(
  model: TreeModel,
): Promise<RecoveryResult> {
  const [chromeWindows, chromeTabs] = await Promise.all([
    queryWindows(),
    queryTabs({}),
  ]);

  const liveWindowIds = new Set(
    chromeWindows.map((w) => w.id).filter((id): id is number => id != null),
  );
  const liveTabIds = new Set(
    chromeTabs.map((t) => t.id).filter((id): id is number => id != null),
  );

  let recoveredCount = 0;
  let newCount = 0;

  // Phase 1: Convert orphaned active nodes → saved
  const orphanedWindows = collectOrphanedWindows(model, liveWindowIds);
  const orphanedTabs = collectOrphanedTabs(model, liveTabIds);

  for (const node of orphanedWindows) {
    const windowData = node.data as WindowData;
    const saved = new SavedWindowTreeNode({
      ...windowData,
      crashDetectedDate: Date.now(),
    });
    saved.copyMarksAndCollapsedFrom(node);
    model.replaceNode(node, saved);
    recoveredCount++;
  }

  for (const node of orphanedTabs) {
    const tabData = node.data as TabData;
    const saved = new SavedTabTreeNode(tabData);
    saved.copyMarksAndCollapsedFrom(node);
    model.replaceNode(node, saved);
    recoveredCount++;
  }

  // Phase 2: Create nodes for Chrome entities not in tree
  const treeWindowIds = new Set<number>();
  const treeTabIds = new Set<number>();

  model.forEach((node) => {
    if (node.type === NodeTypesEnum.WINDOW) {
      const data = node.data as WindowData;
      if (data.id != null) treeWindowIds.add(data.id);
    } else if (node.type === NodeTypesEnum.TAB) {
      const data = node.data as TabData;
      if (data.id != null) treeTabIds.add(data.id);
    }
  });

  // Group new tabs by window for insertion
  const tabsByWindow = new Map<number, ChromeTabData[]>();
  for (const tab of chromeTabs) {
    if (tab.id != null && !treeTabIds.has(tab.id) && tab.windowId != null) {
      const list = tabsByWindow.get(tab.windowId) ?? [];
      list.push(tab);
      tabsByWindow.set(tab.windowId, list);
    }
  }

  for (const win of chromeWindows) {
    if (win.id == null) continue;
    if (!treeWindowIds.has(win.id)) {
      // New window — create window node + its tab nodes
      const winNode = new WindowTreeNode(win as WindowData);
      model.insertAsLastChild(model.root, winNode);
      newCount++;

      const tabs = tabsByWindow.get(win.id) ?? [];
      for (const tab of tabs) {
        const tabNode = new TabTreeNode(tab as TabData);
        model.insertAsLastChild(winNode, tabNode);
        newCount++;
      }
      // Remove tabs from map since they're handled
      tabsByWindow.delete(win.id);
    } else {
      // Existing window — add any new tabs
      const winNode = model.findActiveWindow(win.id);
      if (!winNode) continue;
      const tabs = tabsByWindow.get(win.id) ?? [];
      for (const tab of tabs) {
        const tabNode = new TabTreeNode(tab as TabData);
        model.insertAsLastChild(winNode, tabNode);
        newCount++;
      }
      tabsByWindow.delete(win.id);
    }
  }

  return { recoveredCount, newCount };
}

/** Find active window nodes whose Chrome window no longer exists. */
function collectOrphanedWindows(
  model: TreeModel,
  liveWindowIds: Set<number>,
): TreeNode[] {
  const orphaned: TreeNode[] = [];
  model.forEach((node) => {
    if (node.type === NodeTypesEnum.WINDOW) {
      const data = node.data as WindowData;
      if (data.id != null && !liveWindowIds.has(data.id)) {
        orphaned.push(node);
      }
    }
  });
  return orphaned;
}

/** Find active tab nodes whose Chrome tab no longer exists. */
function collectOrphanedTabs(
  model: TreeModel,
  liveTabIds: Set<number>,
): TreeNode[] {
  const orphaned: TreeNode[] = [];
  model.forEach((node) => {
    if (node.type === NodeTypesEnum.TAB) {
      const data = node.data as TabData;
      if (data.id != null && !liveTabIds.has(data.id)) {
        orphaned.push(node);
      }
    }
  });
  return orphaned;
}
