/**
 * Chrome event handlers — map Chrome tab/window events to tree mutations.
 *
 * Each handler:
 * 1. Finds the relevant tree node (by Chrome ID)
 * 2. Performs the tree mutation
 * 3. Broadcasts the result to connected views
 *
 * Returns a cleanup function that unregisters all listeners.
 */

import type { ActiveSession } from './active-session';
import type { ViewBridge } from './view-bridge';
import { NodeTypesEnum } from '@/types/enums';
import type { TabData, WindowData } from '@/types/node-data';
import type { ChromeTabData } from '@/types/chrome';
import { TreeNode } from '@/tree/tree-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { toNodeDTO, computeParentUpdatesToRoot } from '@/tree/dto';
import {
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onTabMoved,
  onTabAttached,
  onTabDetached,
  onTabActivated,
  onTabReplaced,
  getTab,
} from '@/chrome/tabs';
import {
  onWindowCreated,
  onWindowRemoved,
  onWindowFocusChanged,
} from '@/chrome/windows';

const WINDOW_FOCUS_DEBOUNCE_MS = 100;

/** Register all Chrome tab/window event listeners. Returns cleanup function. */
export function registerChromeEventHandlers(
  session: ActiveSession,
  bridge: ViewBridge,
): () => void {
  const cleanups: Array<() => void> = [];

  cleanups.push(
    onTabCreated((tab) => handleTabCreated(session, bridge, tab)),
  );

  cleanups.push(
    onTabRemoved((tabId, removeInfo) =>
      handleTabRemoved(session, bridge, tabId, removeInfo),
    ),
  );

  cleanups.push(
    onTabUpdated((tabId, _changeInfo, tab) =>
      handleTabUpdated(session, bridge, tabId, tab),
    ),
  );

  cleanups.push(
    onTabMoved((tabId, moveInfo) =>
      handleTabMoved(session, bridge, tabId, moveInfo),
    ),
  );

  cleanups.push(
    onTabAttached((tabId, attachInfo) =>
      handleTabAttached(session, bridge, tabId, attachInfo),
    ),
  );

  // onTabDetached is intentionally a no-op.
  // Chrome fires onTabDetached then onTabAttached when moving tabs between
  // windows. The onTabAttached handler handles the full move, so we register
  // here only to prevent accidental "missing handler" additions later.
  cleanups.push(onTabDetached(() => {}));

  cleanups.push(
    onTabActivated((activeInfo) =>
      handleTabActivated(session, bridge, activeInfo),
    ),
  );

  cleanups.push(
    onTabReplaced((addedTabId, removedTabId) =>
      handleTabReplaced(session, bridge, addedTabId, removedTabId),
    ),
  );

  cleanups.push(
    onWindowCreated((win) => handleWindowCreated(session, bridge, win)),
  );

  cleanups.push(
    onWindowRemoved((windowId) =>
      handleWindowRemoved(session, bridge, windowId),
    ),
  );

  let focusDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  cleanups.push(
    onWindowFocusChanged((windowId) => {
      if (focusDebounceTimer !== null) clearTimeout(focusDebounceTimer);
      focusDebounceTimer = setTimeout(() => {
        focusDebounceTimer = null;
        handleWindowFocusChanged(session, bridge, windowId);
      }, WINDOW_FOCUS_DEBOUNCE_MS);
    }),
  );

  return () => {
    if (focusDebounceTimer !== null) clearTimeout(focusDebounceTimer);
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// -- Individual handlers --

function handleTabCreated(
  session: ActiveSession,
  bridge: ViewBridge,
  tab: ChromeTabData,
): void {
  if (tab.id == null || tab.windowId == null) return;

  // Check for Ctrl+Shift+T undo-close pattern
  const closeRecord = tab.url
    ? session.closeTracker.findByUrl(tab.url)
    : null;

  const winNode = session.treeModel.findActiveWindow(tab.windowId);
  if (!winNode) {
    console.warn(`[chrome-event-handlers] Window ${tab.windowId} not found for new tab ${tab.id}`);
    return;
  }

  const tabNode = new TabTreeNode(tab as TabData);

  if (closeRecord) {
    // Restore at original position if parent still exists
    const parent = session.treeModel.findByMvcId(closeRecord.parentMvcId);
    if (parent) {
      const idx = Math.min(closeRecord.siblingIndex, parent.subnodes.length);
      session.treeModel.insertSubnode(parent, idx, tabNode);
    } else {
      session.treeModel.insertAsLastChild(winNode, tabNode);
    }
  } else {
    session.treeModel.insertAsLastChild(winNode, tabNode);
  }

  notifyNodeInserted(bridge, tabNode);
  session.scheduleSave();
}

function handleTabRemoved(
  session: ActiveSession,
  bridge: ViewBridge,
  tabId: number,
  removeInfo: { windowId: number; isWindowClosing: boolean },
): void {
  const node = session.treeModel.findActiveTab(tabId);
  if (!node) return;

  // Track for undo-close (F3) — must happen before detach
  session.closeTracker.track(node);

  if (removeInfo.isWindowClosing) {
    // Window is closing — the onWindowRemoved handler owns the conversion
    // of all children to saved. Don't remove individual tabs here, otherwise
    // the window handler will find an empty subnodes list.
    return;
  }

  // Tab closed individually
  const tabData = node.data as TabData;

  if (node.isCustomMarksPresent() || node.subnodes.length > 0) {
    // Convert to saved — preserve marks/children
    const saved = new SavedTabTreeNode(tabData);
    saved.copyMarksAndCollapsedFrom(node);
    const oldParent = node.parent;
    session.treeModel.replaceNode(node, saved);
    notifyNodeUpdated(bridge, saved);
    if (oldParent) {
      bridge.broadcast({
        command: 'msg2view_notifyObserver',
        idMVC: saved.idMVC,
        parameters: ['onNodeReplaced'],
        parentsUpdateData: computeParentUpdatesToRoot(oldParent),
      });
    }
  } else {
    // Remove entirely — unmarked tab with no children
    const oldParent = node.parent;
    session.treeModel.removeSubtree(node);
    bridge.broadcast({
      command: 'msg2view_notifyObserver',
      idMVC: node.idMVC,
      parameters: ['onNodeRemoved'],
      parentsUpdateData: oldParent
        ? computeParentUpdatesToRoot(oldParent)
        : undefined,
    });
  }

  session.scheduleSave();
}

function handleTabUpdated(
  session: ActiveSession,
  bridge: ViewBridge,
  tabId: number,
  tab: ChromeTabData,
): void {
  const node = session.treeModel.findActiveTab(tabId);
  if (!node) return;

  if (node.type === NodeTypesEnum.TAB) {
    (node as TabTreeNode).updateChromeData(tab as TabData);
    notifyNodeUpdated(bridge, node);
    session.scheduleSave();
  }
}

function handleTabMoved(
  session: ActiveSession,
  bridge: ViewBridge,
  tabId: number,
  moveInfo: Browser.tabs.OnMovedInfo,
): void {
  const node = session.treeModel.findActiveTab(tabId);
  if (!node || !node.parent) return;

  const winNode = session.treeModel.findActiveWindow(moveInfo.windowId);
  if (!winNode) {
    console.warn(`[chrome-event-handlers] Window ${moveInfo.windowId} not found for moved tab ${tabId}`);
    return;
  }

  // Reorder within the window: remove and re-insert at new position
  node.removeFromParent();
  const insertIdx = Math.min(moveInfo.toIndex, winNode.subnodes.length);
  winNode.insertSubnode(insertIdx, node);

  bridge.broadcast({
    command: 'msg2view_notifyObserver',
    idMVC: node.idMVC,
    parameters: ['onNodeMoved'],
    parentsUpdateData: computeParentUpdatesToRoot(winNode),
  });

  session.scheduleSave();
}

function handleTabAttached(
  session: ActiveSession,
  bridge: ViewBridge,
  tabId: number,
  attachInfo: Browser.tabs.OnAttachedInfo,
): void {
  const node = session.treeModel.findActiveTab(tabId);
  if (!node) return;

  const newWinNode = session.treeModel.findActiveWindow(
    attachInfo.newWindowId,
  );
  if (!newWinNode) {
    console.warn(`[chrome-event-handlers] Window ${attachInfo.newWindowId} not found for attached tab ${tabId}`);
    return;
  }

  // Move tab to new window
  if (node.parent) {
    node.removeFromParent();
  }
  const insertIdx = Math.min(
    attachInfo.newPosition,
    newWinNode.subnodes.length,
  );
  newWinNode.insertSubnode(insertIdx, node);

  bridge.broadcast({
    command: 'msg2view_notifyObserver',
    idMVC: node.idMVC,
    parameters: ['onNodeMoved'],
    parentsUpdateData: computeParentUpdatesToRoot(newWinNode),
  });

  session.scheduleSave();
}

function handleTabActivated(
  session: ActiveSession,
  bridge: ViewBridge,
  activeInfo: Browser.tabs.OnActivatedInfo,
): void {
  // Deactivate all tabs in this window, then activate the new one
  const winNode = session.treeModel.findActiveWindow(activeInfo.windowId);
  if (!winNode) return;

  for (const child of winNode.subnodes) {
    if (
      child.type === NodeTypesEnum.TAB &&
      (child.data as TabData).active
    ) {
      (child as TabTreeNode).updateChromeData({
        ...(child.data as TabData),
        active: false,
      });
      notifyNodeUpdated(bridge, child);
    }
  }

  const node = session.treeModel.findActiveTab(activeInfo.tabId);
  if (node && node.type === NodeTypesEnum.TAB) {
    (node as TabTreeNode).updateChromeData({
      ...(node.data as TabData),
      active: true,
    });
    notifyNodeUpdated(bridge, node);
  }

  session.scheduleSave();
}

async function handleTabReplaced(
  session: ActiveSession,
  bridge: ViewBridge,
  addedTabId: number,
  removedTabId: number,
): Promise<void> {
  const node = session.treeModel.findActiveTab(removedTabId);
  if (!node || node.type !== NodeTypesEnum.TAB) return;

  // Fetch the new tab data from Chrome
  const newTab = await getTab(addedTabId);
  if (!newTab) return;

  // Rebuild indices: remove with old ID, update data, re-insert with new ID
  const parent = node.parent;
  if (parent) {
    const idx = parent.subnodes.indexOf(node);
    session.treeModel.removeSubtree(node);
    (node as TabTreeNode).updateChromeData(newTab as TabData);
    session.treeModel.insertSubnode(parent, idx, node);
  }

  notifyNodeUpdated(bridge, node);
  session.scheduleSave();
}

function handleWindowCreated(
  session: ActiveSession,
  bridge: ViewBridge,
  win: { id?: number; type?: string; focused?: boolean },
): void {
  if (win.id == null) return;

  const existing = session.treeModel.findActiveWindow(win.id);
  if (existing) return; // Already tracked

  const winNode = new WindowTreeNode(win as WindowData);
  session.treeModel.insertAsLastChild(session.treeModel.root, winNode);

  notifyNodeInserted(bridge, winNode);
  session.scheduleSave();
}

function handleWindowRemoved(
  session: ActiveSession,
  bridge: ViewBridge,
  windowId: number,
): void {
  const node = session.treeModel.findActiveWindow(windowId);
  if (!node) return;

  const windowData = node.data as WindowData;
  const saved = new SavedWindowTreeNode({
    ...windowData,
    closeDate: Date.now(),
  });
  saved.copyMarksAndCollapsedFrom(node);

  // Convert all active tabs to saved before replacing the window
  for (const child of [...node.subnodes]) {
    if (child.type === NodeTypesEnum.TAB) {
      const tabData = child.data as TabData;
      const savedTab = new SavedTabTreeNode(tabData);
      savedTab.copyMarksAndCollapsedFrom(child);
      session.treeModel.replaceNode(child, savedTab);
    }
  }

  session.treeModel.replaceNode(node, saved);

  bridge.broadcast({
    command: 'msg2view_notifyObserver',
    idMVC: node.idMVC,
    parameters: ['onWindowClosed'],
    parentsUpdateData: computeParentUpdatesToRoot(saved),
  });

  session.scheduleSave();
}

function handleWindowFocusChanged(
  session: ActiveSession,
  bridge: ViewBridge,
  windowId: number,
): void {
  // Update all windows' focused state
  const windowNodes = session.treeModel.getActiveWindowNodes();
  for (const winNode of windowNodes) {
    const data = winNode.data as WindowData;
    const isFocused = data.id === windowId;
    if (data.focused !== isFocused) {
      (winNode as WindowTreeNode).updateChromeData({
        ...data,
        focused: isFocused,
      });
      notifyNodeUpdated(bridge, winNode);
    }
  }

  session.scheduleSave();
}

// -- Notification helpers --

function notifyNodeInserted(bridge: ViewBridge, node: TreeNode): void {
  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: node.idMVC,
    modelDataCopy: toNodeDTO(node),
  });

  // Propagate parent state changes (e.g., isSubnodesPresent)
  if (node.parent) {
    bridge.broadcast({
      command: 'msg2view_notifyObserver',
      idMVC: node.parent.idMVC,
      parameters: ['onParentUpdated'],
      parentsUpdateData: computeParentUpdatesToRoot(node.parent),
    });
  }
}

function notifyNodeUpdated(bridge: ViewBridge, node: TreeNode): void {
  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: node.idMVC,
    modelDataCopy: toNodeDTO(node),
  });
}
