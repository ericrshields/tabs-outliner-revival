/**
 * Message types for background <-> view communication.
 *
 * BackgroundToViewMessage: discriminated on `command` field
 * ViewToBackgroundMessage: discriminated on `request` field
 *
 * Core message types are fully typed. Remaining ~30 message types are
 * stubbed with catch-all shapes, to be narrowed in later epics as
 * handlers are implemented.
 */

import type { NodeDTO, ParentsUpdateData } from './node-dto';

// -- Background -> View messages -------------------------------------------------------

export interface Msg_InitTreeView {
  readonly command: 'msg2view_initTreeView';
  readonly rootNode_currentSession: NodeDTO;
  readonly globalViewId: number;
  readonly instanceId: string;
}

export interface Msg_NotifyObserver {
  readonly command: 'msg2view_notifyObserver';
  readonly idMVC: string;
  readonly parameters: unknown[];
  readonly parentsUpdateData?: ParentsUpdateData;
}

export interface Msg_NotifyObserverOnNodeUpdated {
  readonly command: 'msg2view_notifyObserver_onNodeUpdated';
  readonly idMVC: string;
  readonly modelDataCopy: NodeDTO;
}

export interface Msg_SetCursorHere {
  readonly command: 'msg2view_setCursorHere';
  readonly targetNodeIdMVC: string;
  readonly doNotScrollView: boolean;
}

export interface Msg_RequestScrollNodeToView {
  readonly command: 'msg2view_requestScrollNodeToViewInAutoscrolledViews';
  readonly idMVC: string;
}

export interface Msg_ContinueToScrollUpToNextOpenWindow {
  readonly command: 'msg2view_continueToScrollUpToNextOpenWindow';
  readonly allOpenWindowsIdMVCs: string[];
}

export interface Msg_OnDragStartedInSomeView {
  readonly command: 'msg2view_onDragStartedInSomeView';
  readonly currentlyDragedIdMVC: string;
}

export interface Msg_ActivateNodeTabEditTextPrompt {
  readonly command: 'msg2view_activateNodeTabEditTextPrompt';
  readonly defaultText: string;
  readonly targetNodeIdMVC: string;
}

export interface Msg_ActivateNodeNoteEditTextPrompt {
  readonly command: 'msg2view_activateNodeNoteEditTextPrompt';
  readonly defaultText: string;
  readonly targetNodeIdMVC: string;
}

export interface Msg_ActivateNodeWindowEditTextPrompt {
  readonly command: 'msg2view_activateNodeWindowEditTextPrompt';
  readonly defaultText: string;
  readonly targetNodeIdMVC: string;
}

export interface Msg_OptionsChanged {
  readonly command: 'msg2view_optionsChanged_message';
  readonly changedOption: string;
}

export interface Msg_SetLicenseStateValid {
  readonly command: 'msg2view_setLicenseState_valid';
  readonly licenseStateValues: unknown;
}

export interface Msg_SetLicenseStateInvalidKeyNotMatch {
  readonly command: 'msg2view_setLicenseState_invalid_KeyPresentIdentityIsAccesibleButNotMatchTheLicenseKey';
  readonly licenseStateValues: unknown;
}

export interface Msg_SetLicenseStateInvalidNotSignedIn {
  readonly command: 'msg2view_setLicenseState_invalid_KeyPresentButChromeIsNotSignedIn';
  readonly licenseStateValues: unknown;
}

export interface Msg_SetLicenseStateInvalidNoEmailPermission {
  readonly command: 'msg2view_setLicenseState_invalid_KeyPresentChromeIsSignedInButNoEmailPermission';
  readonly licenseStateValues: unknown;
}

export interface Msg_SetLicenseStateInvalidNoKey {
  readonly command: 'msg2view_setLicenseState_invalid_NoLicenseKey';
  readonly licenseStateValues: unknown;
}

/** Catch-all for remaining background->view messages not yet fully typed */
export interface Msg_BackgroundToViewGeneric {
  readonly command: string;
  readonly [key: string]: unknown;
}

export type BackgroundToViewMessage =
  | Msg_InitTreeView
  | Msg_NotifyObserver
  | Msg_NotifyObserverOnNodeUpdated
  | Msg_SetCursorHere
  | Msg_RequestScrollNodeToView
  | Msg_ContinueToScrollUpToNextOpenWindow
  | Msg_OnDragStartedInSomeView
  | Msg_ActivateNodeTabEditTextPrompt
  | Msg_ActivateNodeNoteEditTextPrompt
  | Msg_ActivateNodeWindowEditTextPrompt
  | Msg_OptionsChanged
  | Msg_SetLicenseStateValid
  | Msg_SetLicenseStateInvalidKeyNotMatch
  | Msg_SetLicenseStateInvalidNotSignedIn
  | Msg_SetLicenseStateInvalidNoEmailPermission
  | Msg_SetLicenseStateInvalidNoKey
  | Msg_BackgroundToViewGeneric;

// -- View -> Background messages -------------------------------------------------------

export interface Req_GetTreeStructure {
  readonly request: 'request2bkg_get_tree_structure';
}

export interface Req_ActivateNode {
  readonly request: 'request2bkg_activateNode';
  readonly targetNodeIdMVC: string;
}

export interface Req_ActivateHoveringMenuAction {
  readonly request: 'request2bkg_activateHoveringMenuActionOnNode';
  readonly targetNodeIdMVC: string;
  readonly actionId: string;
}

export interface Req_InvertCollapsedState {
  readonly request: 'request2bkg_invertCollapsedState';
  readonly targetNodeIdMVC: string;
}

export interface Req_PerformDrop {
  readonly request: 'request2bkg_performDrop';
  readonly targetNodeIdMVC: string;
  readonly position: number;
  readonly dataTransfer: unknown;
}

export interface Req_MoveHierarchy {
  readonly request: 'request2bkg_moveHierarchy';
  readonly targetNodeIdMVC: string;
  readonly position: number;
}

export interface Req_DeleteHierarchy {
  readonly request: 'request2bkg_deleteHierarchy';
  readonly targetNodeIdMVC: string;
}

export interface Req_CommunicateDragStart {
  readonly request: 'request2bkg_communicateDragStartDataToOtherViews';
  readonly currentlyDragedIdMVC: string;
}

export interface Req_OnOkAfterSetNodeTabText {
  readonly request: 'request2bkg_onOkAfterSetNodeTabTextPrompt';
  readonly targetNodeIdMVC: string;
  readonly newText: string;
}

export interface Req_OnOkAfterSetNodeNoteText {
  readonly request: 'request2bkg_onOkAfterSetNodeNoteTextPrompt';
  readonly targetNodeIdMVC: string;
  readonly newText: string;
}

export interface Req_OnOkAfterSetNodeWindowText {
  readonly request: 'request2bkg_onOkAfterSetNodeWindowTextPrompt';
  readonly targetNodeIdMVC: string;
  readonly newText: string;
}

export interface Req_AddNote {
  readonly request:
    | 'request2bkg_addNoteAsNextSiblingOfCurrentNode'
    | 'request2bkg_addNoteAsLastSubnodeOfCurrentNode'
    | 'request2bkg_addNoteAsParentOfCurrentNode'
    | 'request2bkg_addNoteAsFirstSubnodeOfCurrentNode'
    | 'request2bkg_addNoteAsPrevSiblingOfCurrentNode'
    | 'request2bkg_addNoteAtTheEndOfTree';
  readonly targetNodeIdMVC?: string;
}

export interface Req_FocusTab {
  readonly request: 'request2bkg_focusTab';
  readonly tabWindowId: number;
  readonly tabId: number;
}

export interface Req_CloseAllWindowsExceptThis {
  readonly request: 'request2bkg_closeAllWindowsExceptThis';
  readonly preserveWinId: number;
}

export interface Req_OnViewWindowBeforeUnload {
  readonly request: 'request2bkg_onViewWindowBeforeUnload_saveNow';
}

/** Catch-all for remaining view->background messages not yet fully typed */
export interface Req_ViewToBackgroundGeneric {
  readonly request: string;
  readonly [key: string]: unknown;
}

export type ViewToBackgroundMessage =
  | Req_GetTreeStructure
  | Req_ActivateNode
  | Req_ActivateHoveringMenuAction
  | Req_InvertCollapsedState
  | Req_PerformDrop
  | Req_MoveHierarchy
  | Req_DeleteHierarchy
  | Req_CommunicateDragStart
  | Req_OnOkAfterSetNodeTabText
  | Req_OnOkAfterSetNodeNoteText
  | Req_OnOkAfterSetNodeWindowText
  | Req_AddNote
  | Req_FocusTab
  | Req_CloseAllWindowsExceptThis
  | Req_OnViewWindowBeforeUnload
  | Req_ViewToBackgroundGeneric;
