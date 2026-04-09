/**
 * Message handlers — dispatch view→background messages to actions.
 *
 * Uses a switch on `msg.request` for type-safe, exhaustive handling.
 * Phase 1 implements the 5 essential handlers for tree view to work;
 * Epic 8 stubs (DnD) remain deferred.
 * Epic 9 handlers (edit, copy/paste, context menu) implemented here.
 */

import type {
  ViewToBackgroundMessage,
  Req_ActivateNode,
  Req_InvertCollapsedState,
  Req_ActivateHoveringMenuAction,
  Req_FocusTab,
  Req_ImportTree,
  Req_ExportTree,
  Req_MoveHierarchy,
  Req_OnOkAfterSetNodeTabText,
  Req_OnOkAfterSetNodeNoteText,
  Req_OnOkAfterSetNodeWindowText,
  Req_CopyHierarchy,
  Req_CreateWindow,
  Req_CreateGroup,
  Req_CreateSeparator,
} from '@/types/messages';
import type { MvcId } from '@/types/brands';
import type { ActiveSession } from './active-session';
import type { ViewBridge } from './view-bridge';
import { toNodeDTO, computeParentUpdatesToRoot } from '@/tree/dto';
import { focusTab, createTab, removeTab } from '@/chrome/tabs';
import {
  focusWindow,
  getWindow,
  removeWindow,
  createWindowWithUrl,
} from '@/chrome/windows';
import { TreeNode } from '@/tree/tree-node';
import { TabTreeNode } from '@/tree/nodes/tab-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { WindowTreeNode } from '@/tree/nodes/window-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { GroupTreeNode } from '@/tree/nodes/group-node';
import { SeparatorTreeNode } from '@/tree/nodes/separator-node';
import { TextNoteTreeNode } from '@/tree/nodes/text-note-node';
import type { TabData, WindowData } from '@/types/node-data';
import { NodeTypesEnum } from '@/types/enums';
import {
  removeEmptyWindowParent,
  convertWindowToSaved,
} from './chrome-event-handlers';

const ALLOWED_ACTIONS = new Set([
  'addNoteAction',
  'closeAction',
  'deleteAction',
  'setCursorAction',
  'editTitleAction',
]);

/** Handle a typed view→background message. */
export function handleViewMessage(
  msg: ViewToBackgroundMessage,
  port: Browser.runtime.Port,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  // Ignore heartbeat messages from PortManager
  if ((msg as Record<string, unknown>).__heartbeat) return;

  switch (msg.request) {
    case 'request2bkg_get_tree_structure':
      handleGetTreeStructure(port, session);
      break;

    case 'request2bkg_activateNode':
      void handleActivateNode(
        (msg as Req_ActivateNode).targetNodeIdMVC,
        session,
        bridge,
      );
      break;

    case 'request2bkg_invertCollapsedState':
      handleInvertCollapsedState(
        (msg as Req_InvertCollapsedState).targetNodeIdMVC,
        session,
        bridge,
      );
      break;

    case 'request2bkg_activateHoveringMenuActionOnNode': {
      const action = msg as Req_ActivateHoveringMenuAction;
      handleHoveringMenuAction(
        action.targetNodeIdMVC,
        action.actionId,
        session,
        bridge,
      );
      break;
    }

    case 'request2bkg_onViewWindowBeforeUnload_saveNow':
      void session.saveNow();
      break;

    case 'request2bkg_focusTab': {
      const focus = msg as Req_FocusTab;
      void focusTab(focus.tabId, focus.tabWindowId);
      break;
    }

    case 'request2bkg_import_tree': {
      const importReq = msg as Req_ImportTree;
      void (async () => {
        const result = await session.importTree(importReq.treeJson);
        bridge.sendTo(port, {
          command: 'msg2view_importResult',
          success: result.success,
          nodeCount: result.nodeCount,
          error: result.error,
        });
        if (result.success) {
          bridge.broadcast(session.getInitMessage());
        }
      })();
      break;
    }

    case 'request2bkg_export_tree': {
      const exportReq = msg as Req_ExportTree;
      if (exportReq.format === 'html') {
        const result = session.exportTreeHtml();
        bridge.sendTo(port, {
          command: 'msg2view_exportResult',
          success: result.success,
          treeHtml: result.treeHtml,
          error: result.error,
        });
      } else {
        const result = session.exportTree();
        bridge.sendTo(port, {
          command: 'msg2view_exportResult',
          success: result.success,
          treeJson: result.treeJson,
          error: result.error,
        });
      }
      break;
    }

    case 'request2bkg_moveHierarchy': {
      const moveReq = msg as Req_MoveHierarchy;
      handleMoveHierarchy(
        moveReq.targetNodeIdMVC,
        moveReq.containerIdMVC,
        moveReq.position,
        session,
        bridge,
      );
      break;
    }

    case 'request2bkg_onOkAfterSetNodeTabTextPrompt':
      handleApplyNodeTabText(
        (msg as Req_OnOkAfterSetNodeTabText).targetNodeIdMVC,
        (msg as Req_OnOkAfterSetNodeTabText).newText,
        session,
        bridge,
      );
      break;

    case 'request2bkg_onOkAfterSetNodeNoteTextPrompt':
      handleApplyNodeNoteText(
        (msg as Req_OnOkAfterSetNodeNoteText).targetNodeIdMVC,
        (msg as Req_OnOkAfterSetNodeNoteText).newText,
        session,
        bridge,
      );
      break;

    case 'request2bkg_onOkAfterSetNodeWindowTextPrompt':
      handleApplyNodeWindowText(
        (msg as Req_OnOkAfterSetNodeWindowText).targetNodeIdMVC,
        (msg as Req_OnOkAfterSetNodeWindowText).newText,
        session,
        bridge,
      );
      break;

    case 'request2bkg_copyHierarchy':
      handleCopyHierarchy(
        (msg as Req_CopyHierarchy).sourceIdMVC,
        (msg as Req_CopyHierarchy).targetParentIdMVC,
        (msg as Req_CopyHierarchy).targetPosition,
        session,
        bridge,
      );
      break;

    case 'request2bkg_createWindow':
      handleCreateNode(
        session,
        bridge,
        'window',
        (msg as Req_CreateWindow).afterIdMVC,
      );
      break;

    case 'request2bkg_createGroup':
      handleCreateNode(
        session,
        bridge,
        'group',
        (msg as Req_CreateGroup).afterIdMVC,
      );
      break;

    case 'request2bkg_createSeparator':
      handleCreateNode(
        session,
        bridge,
        'separator',
        (msg as Req_CreateSeparator).afterIdMVC,
      );
      break;

    // -- Deferred handlers (stubbed for later epics) --

    case 'request2bkg_performDrop':
    case 'request2bkg_deleteHierarchy':
    case 'request2bkg_communicateDragStartDataToOtherViews':
      console.warn(
        `[message-handlers] Deferred handler: ${msg.request} (Epic 8)`,
      );
      break;

    case 'request2bkg_addNoteAsNextSiblingOfCurrentNode':
    case 'request2bkg_addNoteAsLastSubnodeOfCurrentNode':
    case 'request2bkg_addNoteAsParentOfCurrentNode':
    case 'request2bkg_addNoteAsFirstSubnodeOfCurrentNode':
    case 'request2bkg_addNoteAsPrevSiblingOfCurrentNode':
    case 'request2bkg_addNoteAtTheEndOfTree':
      console.warn(
        `[message-handlers] Deferred handler: ${msg.request} (future epic)`,
      );
      break;

    case 'request2bkg_closeAllWindowsExceptThis':
      console.warn(`[message-handlers] Deferred handler: ${msg.request}`);
      break;

    default:
      console.warn(
        `[message-handlers] Unknown request: ${(msg as { request: string }).request}`,
      );
      break;
  }
}

// -- Handler implementations --

function handleGetTreeStructure(
  port: Browser.runtime.Port,
  session: ActiveSession,
): void {
  const initMsg = session.getInitMessage();
  try {
    port.postMessage(initMsg);
  } catch {
    // Port may have disconnected
  }
}

/** Check if a URL is safe to restore (http/https only). */
function isRestorableUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Walk the ancestor chain from a saved tab to find which Chrome window
 * it should open in. Returns undefined if no live window is found
 * (caller should create a new one).
 */
async function findTargetWindowForTab(
  node: TreeNode,
): Promise<number | undefined> {
  let ancestor: TreeNode | null = node.parent;
  while (ancestor != null) {
    switch (ancestor.type) {
      case NodeTypesEnum.WINDOW: {
        const wid = (ancestor.data as WindowData).id;
        if (wid != null) return wid;
        return undefined;
      }
      case NodeTypesEnum.TAB: {
        const wid = (ancestor.data as TabData).windowId;
        if (wid != null) return wid;
        return undefined;
      }
      case NodeTypesEnum.SAVEDWINDOW: {
        // Check if the saved window's Chrome ID still exists
        const wid = (ancestor.data as WindowData).id;
        if (wid != null) {
          const existingWin = await getWindow(wid);
          if (existingWin) return wid;
        }
        // Check if a sibling was already restored into a new window
        const activeSibling = ancestor.subnodes.find(
          (sib) =>
            sib.type === NodeTypesEnum.TAB &&
            (sib.data as TabData).windowId != null,
        );
        if (activeSibling) {
          return (activeSibling.data as TabData).windowId;
        }
        return undefined;
      }
      default:
        ancestor = ancestor.parent;
    }
  }
  return undefined;
}

/** Find a Chrome window ID from an active child tab within a container. */
function findActiveWindowIdInChildren(container: TreeNode): number | undefined {
  for (const child of container.subnodes) {
    if (child.type === NodeTypesEnum.TAB) {
      const wid = (child.data as TabData).windowId;
      if (wid != null) return wid;
    }
  }
  return undefined;
}

/**
 * Restore a single saved tab: create Chrome tab, clean up duplicates,
 * replace the saved node with an active one. Returns the resulting
 * window ID and parent node, or null if the restore was skipped.
 */
async function restoreSavedTab(
  savedNodeIdMVC: string,
  url: string,
  targetWindowId: number | undefined,
  session: ActiveSession,
  bridge: ViewBridge,
): Promise<{
  windowId: number | undefined;
  tabParent: TreeNode | null;
} | null> {
  const chromeTabData =
    targetWindowId != null
      ? await createTab({ url, windowId: targetWindowId })
      : await createWindowWithUrl(url);

  // Chrome fires onTabCreated before this await resolves, so
  // handleTabCreated may have already inserted a node for this tab ID.
  // Remove the duplicate before we replace the saved node.
  if (chromeTabData.id != null) {
    const duplicate = session.treeModel.findActiveTab(chromeTabData.id);
    if (duplicate?.parent) {
      const dupParent = duplicate.parent;
      session.treeModel.removeSubtree(duplicate);
      bridge.broadcast({
        command: 'msg2view_notifyObserver',
        idMVC: duplicate.idMVC,
        parameters: ['onNodeRemoved'],
        parentsUpdateData: computeParentUpdatesToRoot(dupParent),
      });
      removeEmptyWindowParent(session, bridge, dupParent);
    }
  }

  // Re-validate: the saved node may have been removed during the async gap.
  const currentNode = session.treeModel.findByMvcId(savedNodeIdMVC as MvcId);
  if (!currentNode || currentNode.type !== NodeTypesEnum.SAVEDTAB) return null;

  const activeTabNode = new TabTreeNode(chromeTabData as TabData);
  activeTabNode.restoredFromSaved = true;
  activeTabNode.copyMarksAndCollapsedFrom(currentNode);
  const tabParent = currentNode.parent;
  if (!tabParent) return null;
  session.treeModel.replaceNode(currentNode, activeTabNode);
  bridge.broadcast({
    command: 'msg2view_notifyObserver',
    idMVC: activeTabNode.idMVC,
    parameters: ['onNodeReplaced'],
    parentsUpdateData: computeParentUpdatesToRoot(tabParent),
  });

  return { windowId: chromeTabData.windowId, tabParent: activeTabNode.parent };
}

/**
 * If the given node is a SavedWindowTreeNode, promote it to an active
 * WindowTreeNode using the Chrome window data. No-op for other types.
 */
async function promoteSavedWindowToActive(
  node: TreeNode | null,
  windowId: number | undefined,
  session: ActiveSession,
  bridge: ViewBridge,
): Promise<void> {
  if (!node || node.type !== NodeTypesEnum.SAVEDWINDOW || windowId == null)
    return;

  const winData = await getWindow(windowId);
  if (!winData) return;

  const activeWin = new WindowTreeNode(winData as WindowData);
  activeWin.copyMarksAndCollapsedFrom(node);
  session.treeModel.replaceNode(node, activeWin);
  bridge.broadcast({
    command: 'msg2view_notifyObserver',
    idMVC: node.idMVC,
    parameters: ['onNodeReplaced'],
    parentsUpdateData: node.parent
      ? computeParentUpdatesToRoot(node.parent)
      : undefined,
  });
}

async function handleActivateNode(
  targetNodeIdMVC: string,
  session: ActiveSession,
  bridge: ViewBridge,
): Promise<void> {
  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node) return;

  switch (node.type) {
    case NodeTypesEnum.TAB: {
      const tabData = node.data as TabData;
      if (tabData.id != null && tabData.windowId != null) {
        void focusTab(tabData.id, tabData.windowId);
      }
      break;
    }

    case NodeTypesEnum.SAVEDTAB: {
      const url = (node.data as TabData).url;
      if (!url || !isRestorableUrl(url)) break;

      const targetWindowId = await findTargetWindowForTab(node);

      try {
        const result = await restoreSavedTab(
          targetNodeIdMVC,
          url,
          targetWindowId,
          session,
          bridge,
        );
        if (!result) break;

        await promoteSavedWindowToActive(
          result.tabParent,
          result.windowId,
          session,
          bridge,
        );
        session.scheduleSave();
      } catch (err) {
        console.error('[message-handlers] Failed to open saved tab:', err);
      }
      break;
    }

    case NodeTypesEnum.WINDOW: {
      const windowId = (node.data as WindowData).id;
      if (windowId == null) break;

      try {
        await focusWindow(windowId);
      } catch (err) {
        console.error('[message-handlers] Failed to focus window:', err);
      }
      break;
    }

    case NodeTypesEnum.SAVEDWINDOW:
    case NodeTypesEnum.GROUP: {
      const savedChildren = node.subnodes.filter(
        (child) =>
          child.type === NodeTypesEnum.SAVEDTAB &&
          isRestorableUrl((child.data as TabData).url),
      );
      if (savedChildren.length === 0) break;

      // Reuse an existing live window if any sibling tab is already active.
      let windowId = findActiveWindowIdInChildren(node);

      try {
        for (const savedChild of savedChildren) {
          const url = (savedChild.data as TabData).url;
          if (!url) continue;

          const result = await restoreSavedTab(
            savedChild.idMVC,
            url,
            windowId,
            session,
            bridge,
          );
          if (!result) continue;

          // Capture window ID from the first tab for subsequent tabs
          if (windowId == null) windowId = result.windowId;
        }

        await promoteSavedWindowToActive(
          session.treeModel.findByMvcId(targetNodeIdMVC as MvcId),
          windowId,
          session,
          bridge,
        );
        session.scheduleSave();
      } catch (err) {
        console.error(
          '[message-handlers] Failed to restore container tabs:',
          err,
        );
      }
      break;
    }

    default:
      // SESSION, TEXTNOTE, SEPARATOR — no action on click
      break;
  }
}

function handleInvertCollapsedState(
  targetNodeIdMVC: string,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node) return;

  session.treeModel.setCollapsed(node, !node.colapsed);

  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: node.idMVC,
    modelDataCopy: toNodeDTO(node),
  });

  session.scheduleSave();
}

function handleHoveringMenuAction(
  targetNodeIdMVC: string,
  actionId: string,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  if (!ALLOWED_ACTIONS.has(actionId)) {
    console.warn(`[message-handlers] Rejected unknown action: ${actionId}`);
    return;
  }

  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node) return;

  switch (actionId) {
    case 'closeAction': {
      if (node.type === NodeTypesEnum.TAB) {
        const tabData = node.data as TabData;
        // Convert to saved BEFORE closing — "Close" preserves the node.
        // When handleTabRemoved fires, findActiveTab won't find the
        // saved node, so it no-ops.
        const saved = new SavedTabTreeNode({ ...tabData, active: false });
        saved.copyMarksAndCollapsedFrom(node);
        const oldParent = node.parent;
        if (oldParent) {
          session.treeModel.replaceNode(node, saved);
          bridge.broadcast({
            command: 'msg2view_notifyObserver',
            idMVC: saved.idMVC,
            parameters: ['onNodeReplaced'],
            parentsUpdateData: computeParentUpdatesToRoot(oldParent),
          });
          session.scheduleSave();
        }
        if (tabData.id != null) {
          void removeTab(tabData.id);
        }
      } else if (node.type === NodeTypesEnum.WINDOW) {
        const winData = node.data as WindowData;

        // Track all active child tabs for undo-close (F3) BEFORE
        // conversion — track() reads node.parent which is cleared
        // by replaceNode.
        for (const child of node.subnodes) {
          if (child.type === NodeTypesEnum.TAB) {
            session.closeTracker.track(child);
          }
        }

        // Convert to saved BEFORE closing — matches tab close pattern.
        // When handleWindowRemoved fires, findActiveWindow won't find the
        // saved node, so it no-ops.
        const savedWin = convertWindowToSaved(session.treeModel, node);
        bridge.broadcast({
          command: 'msg2view_notifyObserver',
          idMVC: node.idMVC,
          parameters: ['onWindowClosed'],
          parentsUpdateData: computeParentUpdatesToRoot(savedWin),
        });
        session.scheduleSave();

        if (winData.id != null) {
          void removeWindow(winData.id);
        }
      }
      break;
    }

    case 'deleteAction': {
      const oldParent = node.parent;

      // Find the next cursor target before deletion (siblings shift after removal).
      let nextCursorId: string | null = null;
      if (oldParent) {
        const siblings = oldParent.subnodes;
        const idx = siblings.indexOf(node as TreeNode);
        if (idx >= 0) {
          const next = (siblings[idx + 1] ?? siblings[idx - 1]) as
            | TreeNode
            | undefined;
          if (next) nextCursorId = next.idMVC;
        }
      }

      session.treeModel.removeSubtree(node);
      bridge.broadcast({
        command: 'msg2view_notifyObserver',
        idMVC: node.idMVC,
        parameters: ['onNodeRemoved'],
        parentsUpdateData: oldParent
          ? computeParentUpdatesToRoot(oldParent)
          : undefined,
      });
      removeEmptyWindowParent(session, bridge, oldParent);

      if (nextCursorId) {
        bridge.broadcast({
          command: 'msg2view_setCursorHere',
          targetNodeIdMVC: nextCursorId,
          doNotScrollView: false,
        });
      }

      session.scheduleSave();
      break;
    }

    case 'setCursorAction': {
      // User-initiated cursor moves should scroll into view
      bridge.broadcast({
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: node.idMVC,
        doNotScrollView: false,
      });
      break;
    }

    case 'addNoteAction':
    case 'editTitleAction': {
      // For tab nodes, both actions open the same inline edit for customTitle.
      // addNoteAction is the hover menu entry point; editTitleAction is used
      // by context menu, keyboard shortcuts (F2), and double-click.
      if (
        node.type === NodeTypesEnum.TAB ||
        node.type === NodeTypesEnum.SAVEDTAB ||
        node.type === NodeTypesEnum.WAITINGTAB ||
        node.type === NodeTypesEnum.ATTACHWAITINGTAB
      ) {
        bridge.broadcast({
          command: 'msg2view_activateNodeTabEditTextPrompt',
          targetNodeIdMVC: node.idMVC,
          defaultText: node.getCustomTitle() ?? '',
        });
      } else if (
        node.type === NodeTypesEnum.WINDOW ||
        node.type === NodeTypesEnum.SAVEDWINDOW ||
        node.type === NodeTypesEnum.WAITINGWINDOW ||
        node.type === NodeTypesEnum.GROUP
      ) {
        bridge.broadcast({
          command: 'msg2view_activateNodeWindowEditTextPrompt',
          targetNodeIdMVC: node.idMVC,
          defaultText: node.getCustomTitle() ?? '',
        });
      } else if (
        actionId === 'editTitleAction' &&
        node.type === NodeTypesEnum.TEXTNOTE
      ) {
        bridge.broadcast({
          command: 'msg2view_activateNodeNoteEditTextPrompt',
          targetNodeIdMVC: node.idMVC,
          defaultText: (node as unknown as TextNoteTreeNode).persistentData
            .note,
        });
      } else if (
        actionId === 'editTitleAction' &&
        node.type === NodeTypesEnum.SEPARATORLINE
      ) {
        // Separator edit cycles styles rather than showing a text prompt.
        (node as unknown as SeparatorTreeNode).cycleStyle();
        bridge.broadcast({
          command: 'msg2view_notifyObserver_onNodeUpdated',
          idMVC: node.idMVC,
          modelDataCopy: toNodeDTO(node),
        });
        session.scheduleSave();
      }
      break;
    }

    default:
      break;
  }
}

function handleMoveHierarchy(
  sourceIdMVC: string,
  containerIdMVC: string | null,
  position: number,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  const source = session.treeModel.findByMvcId(sourceIdMVC as MvcId);
  if (!source || !source.parent) return;

  // Tab nodes cannot live at root — auto-wrap in a new saved window.
  // `position` is the root-level insertion index for the wrapper;
  // the tab goes as position 0 inside the (empty) wrapper.
  let movePosition = position;
  if (
    containerIdMVC === null &&
    source.titleBackgroundCssClass === 'tabFrame'
  ) {
    const wrapper = new SavedWindowTreeNode();
    const root = session.treeModel.root;
    if (!root) return;
    session.treeModel.insertSubnode(root, position, wrapper);
    containerIdMVC = wrapper.idMVC;
    movePosition = 0;
  }

  const oldParent = source.parent;
  try {
    session.treeModel.moveNode(source, {
      containerIdMVC,
      position: movePosition,
    });
  } catch (err) {
    console.error('[message-handlers] moveNode failed:', err);
    return;
  }

  // If the target container was collapsed, expand it so the moved node
  // is visible (otherwise it appears to disappear).
  const targetParent = source.parent;
  if (targetParent && targetParent.colapsed) {
    session.treeModel.setCollapsed(targetParent, false);
    bridge.broadcast({
      command: 'msg2view_notifyObserver_onNodeUpdated',
      idMVC: targetParent.idMVC,
      modelDataCopy: toNodeDTO(targetParent),
    });
  }

  bridge.broadcast({
    command: 'msg2view_notifyObserver',
    idMVC: source.idMVC,
    parameters: ['onNodeMoved'],
    parentsUpdateData: computeParentUpdatesToRoot(oldParent),
  });

  session.scheduleSave();
}

function handleApplyNodeTabText(
  targetNodeIdMVC: string,
  newText: string,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node) return;

  session.treeModel.setMarks(node, {
    ...node.marks,
    customTitle: newText.trim() || undefined,
  });

  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: node.idMVC,
    modelDataCopy: toNodeDTO(node),
  });

  session.scheduleSave();
}

function handleApplyNodeNoteText(
  targetNodeIdMVC: string,
  newText: string,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node || node.type !== NodeTypesEnum.TEXTNOTE) return;

  (node as unknown as TextNoteTreeNode).setNote(newText);

  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: node.idMVC,
    modelDataCopy: toNodeDTO(node),
  });

  session.scheduleSave();
}

function handleApplyNodeWindowText(
  targetNodeIdMVC: string,
  newText: string,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node) return;

  session.treeModel.setMarks(node, {
    ...node.marks,
    customTitle: newText.trim() || undefined,
  });

  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: node.idMVC,
    modelDataCopy: toNodeDTO(node),
  });

  session.scheduleSave();
}

/**
 * Create a new node of the given type and insert it after `afterIdMVC`
 * (as a sibling). Falls back to appending at root if the cursor node is
 * not found or is the root itself.
 */
function handleCreateNode(
  session: ActiveSession,
  bridge: ViewBridge,
  nodeType: 'window' | 'group' | 'separator',
  afterIdMVC: string | null,
): void {
  const root = session.treeModel.root;
  if (!root) return;

  const newNode =
    nodeType === 'window'
      ? new SavedWindowTreeNode()
      : nodeType === 'group'
        ? new GroupTreeNode()
        : new SeparatorTreeNode();

  const afterNode = afterIdMVC
    ? session.treeModel.findByMvcId(afterIdMVC as MvcId)
    : null;

  if (afterNode && afterNode.parent !== null) {
    session.treeModel.insertAfter(afterNode, newNode);
  } else {
    session.treeModel.insertAsLastChild(root, newNode);
  }

  // Notify view of the new node
  bridge.broadcast({
    command: 'msg2view_notifyObserver_onNodeUpdated',
    idMVC: newNode.idMVC,
    modelDataCopy: toNodeDTO(newNode),
  });

  // Notify parent so its subnodes list updates (skip root — it has no DTO row)
  const parent = newNode.parent;
  if (parent && parent.parent !== null) {
    bridge.broadcast({
      command: 'msg2view_notifyObserver_onNodeUpdated',
      idMVC: parent.idMVC,
      modelDataCopy: toNodeDTO(parent),
    });
  }

  // Move cursor to the new node and scroll it into view
  bridge.broadcast({
    command: 'msg2view_setCursorHere',
    targetNodeIdMVC: newNode.idMVC,
    doNotScrollView: false,
  });

  session.scheduleSave();
}

/**
 * Deep-clone a node subtree, converting active nodes to their saved
 * equivalents. Each cloned node gets a fresh idMVC via cloneAsSaved().
 */
function cloneSubtree(node: TreeNode): TreeNode {
  const clone = node.cloneAsSaved();
  for (const child of node.subnodes) {
    const childClone = cloneSubtree(child as TreeNode);
    childClone.parent = clone;
    clone.subnodes.push(childClone);
  }
  return clone;
}

function handleCopyHierarchy(
  sourceIdMVC: string,
  targetParentIdMVC: string | null,
  targetPosition: number,
  session: ActiveSession,
  bridge: ViewBridge,
): void {
  const source = session.treeModel.findByMvcId(sourceIdMVC as MvcId);
  if (!source || !source.parent) return;

  const clone = cloneSubtree(source as TreeNode);

  // Tab nodes cannot live at root — auto-wrap in a new saved window,
  // mirroring the same logic in handleMoveHierarchy.
  let containerIdMVC = targetParentIdMVC;
  let insertPosition = targetPosition;

  if (
    containerIdMVC === null &&
    source.titleBackgroundCssClass === 'tabFrame'
  ) {
    const wrapper = new SavedWindowTreeNode();
    const root = session.treeModel.root;
    if (!root) return;
    const wrapperPos =
      insertPosition === -1 ? root.subnodes.length : insertPosition;
    session.treeModel.insertSubnode(root, wrapperPos, wrapper);
    containerIdMVC = wrapper.idMVC;
    insertPosition = 0; // clone goes as first (and only) child of new wrapper
  }

  const targetParent =
    containerIdMVC != null
      ? session.treeModel.findByMvcId(containerIdMVC as MvcId)
      : session.treeModel.root;
  if (!targetParent) return;

  const finalPosition =
    insertPosition === -1 ? targetParent.subnodes.length : insertPosition;

  session.treeModel.insertSubnode(
    targetParent as TreeNode,
    finalPosition,
    clone,
  );

  // Full broadcast: clone adds a new node with a new idMVC;
  // incremental diff not worth the complexity for a rare operation.
  bridge.broadcast(session.getInitMessage());

  session.scheduleSave();
}
