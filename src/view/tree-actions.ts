/**
 * Pure message constructors for view → background communication.
 *
 * Each function returns a ViewToBackgroundMessage — no side effects.
 * The caller is responsible for posting the message via the port.
 */

import type {
  Req_GetTreeStructure,
  Req_ActivateNode,
  Req_InvertCollapsedState,
  Req_ActivateHoveringMenuAction,
  Req_OnViewWindowBeforeUnload,
  Req_ImportTree,
  Req_ExportTree,
  Req_MoveHierarchy,
  Req_CopyHierarchy,
  Req_OnOkAfterSetNodeTabText,
  Req_OnOkAfterSetNodeNoteText,
  Req_OnOkAfterSetNodeWindowText,
} from '@/types/messages';

/** Request the full tree structure from the background. */
export function requestTree(): Req_GetTreeStructure {
  return { request: 'request2bkg_get_tree_structure' };
}

/** Activate (focus) a tab node in the browser. */
export function activateNode(idMVC: string): Req_ActivateNode {
  return {
    request: 'request2bkg_activateNode',
    targetNodeIdMVC: idMVC,
  };
}

/** Toggle the collapsed state of a node. */
export function toggleCollapse(idMVC: string): Req_InvertCollapsedState {
  return {
    request: 'request2bkg_invertCollapsedState',
    targetNodeIdMVC: idMVC,
  };
}

/** Execute a hovering menu action on a node. */
export function executeAction(
  idMVC: string,
  actionId: string,
): Req_ActivateHoveringMenuAction {
  return {
    request: 'request2bkg_activateHoveringMenuActionOnNode',
    targetNodeIdMVC: idMVC,
    actionId,
  };
}

/** Notify the background that the view is unloading (best-effort save). */
export function notifyUnload(): Req_OnViewWindowBeforeUnload {
  return { request: 'request2bkg_onViewWindowBeforeUnload_saveNow' };
}

/** Request import of a tree from a JSON string (HierarchyJSO or operations log). */
export function importTree(treeJson: string): Req_ImportTree {
  return { request: 'request2bkg_import_tree', treeJson };
}

/** Request export of the current tree as a JSON string. */
export function exportTree(): Req_ExportTree {
  return { request: 'request2bkg_export_tree' };
}

/** Request export of the current tree as HTML. */
export function exportTreeHtml(): Req_ExportTree {
  return { request: 'request2bkg_export_tree', format: 'html' };
}

/** Move a node to a new position in the tree. */
export function moveHierarchy(
  sourceIdMVC: string,
  containerIdMVC: string | null,
  position: number,
): Req_MoveHierarchy {
  return {
    request: 'request2bkg_moveHierarchy',
    targetNodeIdMVC: sourceIdMVC,
    containerIdMVC,
    position,
  };
}

/** Deep-clone a node subtree and insert it at the target position. */
export function copyHierarchy(
  sourceIdMVC: string,
  targetParentIdMVC: string | null,
  targetPosition: number,
): Req_CopyHierarchy {
  return {
    request: 'request2bkg_copyHierarchy',
    sourceIdMVC,
    targetParentIdMVC,
    targetPosition,
  };
}

/** Commit an edited title for a tab node. */
export function applyNodeTabText(
  idMVC: string,
  newText: string,
): Req_OnOkAfterSetNodeTabText {
  return {
    request: 'request2bkg_onOkAfterSetNodeTabTextPrompt',
    targetNodeIdMVC: idMVC,
    newText,
  };
}

/** Commit edited text content for a text note node. */
export function applyNodeNoteText(
  idMVC: string,
  newText: string,
): Req_OnOkAfterSetNodeNoteText {
  return {
    request: 'request2bkg_onOkAfterSetNodeNoteTextPrompt',
    targetNodeIdMVC: idMVC,
    newText,
  };
}

/** Commit an edited title for a window or group node. */
export function applyNodeWindowText(
  idMVC: string,
  newText: string,
): Req_OnOkAfterSetNodeWindowText {
  return {
    request: 'request2bkg_onOkAfterSetNodeWindowTextPrompt',
    targetNodeIdMVC: idMVC,
    newText,
  };
}
