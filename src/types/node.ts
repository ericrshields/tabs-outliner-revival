/**
 * NodeModel — the core tree node type system.
 *
 * NodeModelBase defines shared fields, and 11 concrete node interfaces
 * narrow `type` and `data` for each variant. NodeModel is the discriminated
 * union of all 11, enabling exhaustive switch/case on `type`.
 *
 * Colocated in one file to avoid circular imports (NodeModelBase.parent
 * references NodeModel and vice versa).
 */

import type { DiffId, MvcId, NodeId } from './brands';
import type { NodeType, NodeTypesEnum } from './enums';
import type { NodeMarks } from './marks';
import type {
  GroupData,
  SeparatorData,
  SessionData,
  TabData,
  TextNoteData,
  WindowData,
} from './node-data';

export type TitleBackgroundCssClass =
  | 'windowFrame'
  | 'tabFrame'
  | 'defaultFrame';

export type HoveringMenuActionId =
  | 'closeAction'
  | 'deleteAction'
  | 'editTitleAction'
  | 'setCursorAction';

export interface HoveringMenuAction {
  readonly id: HoveringMenuActionId;
  /** Action performer — port type is intentionally loose to avoid chrome types dependency */
  readonly performAction: (node: NodeModel, port: unknown) => void;
}

/** Shared fields present on every node in the tree */
export interface NodeModelBase {
  /** MVC communication ID — unique per runtime instance, e.g. "idmvc42" */
  readonly idMVC: MvcId;
  /** Previous idMVC, if the node was replaced */
  readonly previousIdMVC?: MvcId;
  /** Node type discriminant */
  readonly type: NodeType;
  /** CSS class derived from type, used for title styling */
  readonly titleCssClass: string;
  /** Background CSS class — "windowFrame", "tabFrame", or "defaultFrame" */
  readonly titleBackgroundCssClass: TitleBackgroundCssClass;
  /** Whether the node's children are collapsed in the view */
  colapsed: boolean;
  /** Custom visual marks (relicons, colors, custom title/favicon) */
  marks: NodeMarks;
  /** Node identity ID — e.g. "tab42", "win7" (present on active tabs/windows) */
  readonly id?: NodeId;
  /** Parent node, null for root */
  parent: NodeModel | null;
  /** Child nodes */
  subnodes: NodeModel[];
  /** Node difference ID — tracks structural changes */
  dId?: DiffId;
  /** Content difference ID — tracks data changes */
  cdId?: DiffId;
  /** Subnodes difference ID — tracks child list changes */
  sdId?: DiffId;
  /** Serialized knot with dId == sdId, used as base for subnodes diff */
  sdIdKnot?: string | null;
  /** Whether this node is a hyperlink */
  readonly isLink?: boolean;
  /** Whether node needs the favicon+text helper container in view */
  readonly needFaviconAndTextHelperContainer?: boolean;
  /** Timestamp when the node was created */
  readonly created?: number;
  /** Timestamp when the node was last modified */
  lastmod?: number;
  /** Hovering menu actions available for this node */
  readonly hoveringMenuActions: Partial<
    Record<HoveringMenuActionId, HoveringMenuAction>
  >;
  /** Cached flag for "protected from gone on close" state */
  isProtectedFromGoneOnCloseCache: boolean;
}

// -- Concrete node interfaces (one per NodeTypesEnum value) -------------------------

export interface SessionNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.SESSION;
  readonly titleBackgroundCssClass: 'windowFrame';
  readonly data: SessionData;
  readonly persistentData: SessionData;
}

export interface TextNoteNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.TEXTNOTE;
  readonly titleBackgroundCssClass: 'defaultFrame';
  readonly data: TextNoteData;
  readonly persistentData: TextNoteData;
}

export interface SeparatorNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.SEPARATORLINE;
  readonly titleBackgroundCssClass: 'defaultFrame';
  readonly data: SeparatorData;
  readonly persistentData: SeparatorData;
}

export interface TabNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.TAB;
  readonly titleBackgroundCssClass: 'tabFrame';
  readonly data: TabData;
  readonly chromeTabObj: TabData;
}

export interface SavedTabNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.SAVEDTAB;
  readonly titleBackgroundCssClass: 'tabFrame';
  readonly data: TabData;
  readonly persistentData: TabData;
}

export interface WaitingTabNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.WAITINGTAB;
  readonly titleBackgroundCssClass: 'tabFrame';
  readonly data: TabData;
  readonly persistentData: TabData;
}

export interface AttachWaitTabNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.ATTACHWAITINGTAB;
  readonly titleBackgroundCssClass: 'tabFrame';
  readonly data: TabData;
  readonly chromeTabObj: TabData;
}

export interface WindowNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.WINDOW;
  readonly titleBackgroundCssClass: 'windowFrame';
  readonly data: WindowData;
  readonly chromeWindowObj: WindowData;
}

export interface SavedWindowNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.SAVEDWINDOW;
  readonly titleBackgroundCssClass: 'windowFrame';
  readonly data: WindowData;
  readonly persistentData: WindowData;
}

export interface WaitingWindowNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.WAITINGWINDOW;
  readonly titleBackgroundCssClass: 'windowFrame';
  readonly data: WindowData;
  readonly persistentData: WindowData;
}

export interface GroupNode extends NodeModelBase {
  readonly type: typeof NodeTypesEnum.GROUP;
  readonly titleBackgroundCssClass: 'defaultFrame';
  readonly data: GroupData;
}

/** Discriminated union of all 11 node types — narrows on `type` field */
export type NodeModel =
  | SessionNode
  | TextNoteNode
  | SeparatorNode
  | TabNode
  | SavedTabNode
  | WaitingTabNode
  | AttachWaitTabNode
  | WindowNode
  | SavedWindowNode
  | WaitingWindowNode
  | GroupNode;
