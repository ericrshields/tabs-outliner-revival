/**
 * NodeDTO — the data transfer object sent from background to view.
 *
 * This is a plain-object snapshot of a NodeModel, created by
 * NodeModelMVCDataTransferObject in the legacy code.
 */

import type { MvcId } from './brands';
import type { NodeMarks } from './marks';
import type { HoveringMenuActionId, TitleBackgroundCssClass } from './node';

export interface StatsBlock {
  readonly nodesCount: number;
  readonly activeTabsCount: number;
  readonly savedTabsCount: number;
  readonly activeWinsCount: number;
  readonly savedWinsCount: number;
  /** Group with at least one active tab/window descendant — Chrome maintains a window for it. */
  readonly activeGroupsCount: number;
  /** Group with no active descendants — purely organizational. */
  readonly savedGroupsCount: number;
  readonly notesCount: number;
  readonly separatorsCount: number;
  readonly sessionsCount: number;
}

/** Mutable counterpart of StatsBlock used during accumulation. */
export type MutableStatsBlock = {
  -readonly [K in keyof StatsBlock]: StatsBlock[K];
};

export interface NodeDTO {
  readonly id: MvcId;
  readonly idMVC: MvcId;
  readonly previousIdMVC?: MvcId;
  colapsed: boolean;
  subnodes: NodeDTO[];
  readonly isLink?: boolean;
  readonly titleCssClass: string;
  titleBackgroundCssClass: TitleBackgroundCssClass;
  readonly additionalTextCss?: string;
  readonly needFaviconAndTextHelperContainer?: boolean;
  marks: NodeMarks;

  // Computed fields
  customTitle: string | null;
  hoveringMenuActions: Partial<
    Record<HoveringMenuActionId, { id: HoveringMenuActionId }>
  >;
  statsBlockData: StatsBlock | null;
  icon: string;
  iconForHtmlExport: string;
  tooltipText: string;
  href: string | null;
  nodeText: string;
  isSelectedTab: boolean;
  isFocusedWindow: boolean;
  isProtectedFromGoneOnClose: boolean;
  nodeContentCssClass: string;
  nodeTextCustomStyle: string | null;
  isSubnodesPresent: boolean;
}

/**
 * Patch data sent with observer notifications when parent nodes
 * need updating after child changes.
 */
export interface ParentUpdateData {
  readonly isSubnodesPresent: boolean;
  readonly isCollapsed: boolean;
  readonly subnodesStatBlock: StatsBlock | null;
  readonly isProtectedFromGoneOnClose: boolean;
  readonly titleCssClass: string;
  readonly titleBackgroundCssClass: TitleBackgroundCssClass;
  readonly isSelectedTab: boolean;
  readonly isFocusedWindow: boolean;
  readonly nodeContentCssClass: string;
}

/**
 * Map of parent updates keyed by idMVC string.
 * Uses plain string keys (not branded MvcId) because this is a wire format.
 */
export type ParentsUpdateData = Record<string, ParentUpdateData>;
