/**
 * Message handlers — dispatch view→background messages to actions.
 *
 * Uses a switch on `msg.request` for type-safe, exhaustive handling.
 * Phase 1 implements the 5 essential handlers for tree view to work;
 * remaining messages are stubbed with console.warn and will be
 * implemented in later epics (DnD in Epic 8, notes in Epic 9).
 */

import type {
  ViewToBackgroundMessage,
  Req_ActivateNode,
  Req_InvertCollapsedState,
  Req_ActivateHoveringMenuAction,
  Req_FocusTab,
} from '@/types/messages';
import type { MvcId } from '@/types/brands';
import type { ActiveSession } from './active-session';
import type { ViewBridge } from './view-bridge';
import { toNodeDTO } from '@/tree/dto';
import { focusTab, removeTab } from '@/chrome/tabs';
import { removeWindow } from '@/chrome/windows';
import type { TabData, WindowData } from '@/types/node-data';
import { NodeTypesEnum } from '@/types/enums';

const ALLOWED_ACTIONS = new Set([
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
      handleActivateNode((msg as Req_ActivateNode).targetNodeIdMVC, session);
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

    // -- Deferred handlers (stubbed for later epics) --

    case 'request2bkg_performDrop':
    case 'request2bkg_moveHierarchy':
    case 'request2bkg_deleteHierarchy':
    case 'request2bkg_communicateDragStartDataToOtherViews':
      console.warn(`[message-handlers] Deferred handler: ${msg.request} (Epic 8)`);
      break;

    case 'request2bkg_onOkAfterSetNodeTabTextPrompt':
    case 'request2bkg_onOkAfterSetNodeNoteTextPrompt':
    case 'request2bkg_onOkAfterSetNodeWindowTextPrompt':
    case 'request2bkg_addNoteAsNextSiblingOfCurrentNode':
    case 'request2bkg_addNoteAsLastSubnodeOfCurrentNode':
    case 'request2bkg_addNoteAsParentOfCurrentNode':
    case 'request2bkg_addNoteAsFirstSubnodeOfCurrentNode':
    case 'request2bkg_addNoteAsPrevSiblingOfCurrentNode':
    case 'request2bkg_addNoteAtTheEndOfTree':
      console.warn(`[message-handlers] Deferred handler: ${msg.request} (Epic 9)`);
      break;

    case 'request2bkg_closeAllWindowsExceptThis':
      console.warn(`[message-handlers] Deferred handler: ${msg.request}`);
      break;

    default:
      console.warn(`[message-handlers] Unknown request: ${(msg as { request: string }).request}`);
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

function handleActivateNode(
  targetNodeIdMVC: string,
  session: ActiveSession,
): void {
  const node = session.treeModel.findByMvcId(targetNodeIdMVC as MvcId);
  if (!node) return;

  // Activate = focus the Chrome tab
  if (node.type === NodeTypesEnum.TAB) {
    const tabData = node.data as TabData;
    if (tabData.id != null && tabData.windowId != null) {
      void focusTab(tabData.id, tabData.windowId);
    }
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
        if (tabData.id != null) {
          void removeTab(tabData.id);
        }
      } else if (node.type === NodeTypesEnum.WINDOW) {
        const winData = node.data as WindowData;
        if (winData.id != null) {
          void removeWindow(winData.id);
        }
      }
      break;
    }

    case 'deleteAction': {
      session.treeModel.removeSubtree(node);
      bridge.broadcast({
        command: 'msg2view_notifyObserver',
        idMVC: node.idMVC,
        parameters: ['onNodeRemoved'],
      });
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

    case 'editTitleAction': {
      if (node.type === NodeTypesEnum.TAB || node.type === NodeTypesEnum.SAVEDTAB) {
        bridge.broadcast({
          command: 'msg2view_activateNodeTabEditTextPrompt',
          targetNodeIdMVC: node.idMVC,
          defaultText: node.getCustomTitle() ?? node.getNodeText(),
        });
      } else if (
        node.type === NodeTypesEnum.WINDOW ||
        node.type === NodeTypesEnum.SAVEDWINDOW
      ) {
        bridge.broadcast({
          command: 'msg2view_activateNodeWindowEditTextPrompt',
          targetNodeIdMVC: node.idMVC,
          defaultText: node.getCustomTitle() ?? node.getNodeText(),
        });
      }
      break;
    }

    default:
      break;
  }
}
