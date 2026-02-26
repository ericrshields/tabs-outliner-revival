/**
 * DTO generation — TreeNode → NodeDTO for view communication.
 *
 * Port of legacy NodeModelMVCDataTransferObject constructor.
 * Snapshots all computed values from the tree node into a plain object
 * that can be sent via message passing to the view.
 */

import type { NodeDTO, ParentUpdateData, ParentsUpdateData, StatsBlock } from '@/types/node-dto';
import type { HoveringMenuActionId } from '@/types/node';
import type { MvcId } from '@/types/brands';
import { TreeNode } from './tree-node';

/**
 * Generate a NodeDTO snapshot for view communication.
 *
 * Recursively builds DTOs for expanded children. Collapsed nodes get
 * `subnodes: []` with `statsBlockData` populated.
 */
export function toNodeDTO(node: TreeNode): NodeDTO {
  const subnodes: NodeDTO[] = [];
  if (!node.colapsed) {
    for (const child of node.subnodes) {
      subnodes.push(toNodeDTO(child));
    }
  }

  const hoveringMenuActions = node.getHoveringMenuActions();
  const actionIds: Partial<Record<HoveringMenuActionId, { id: HoveringMenuActionId }>> = {};
  for (const key of Object.keys(hoveringMenuActions) as HoveringMenuActionId[]) {
    if (hoveringMenuActions[key]) {
      actionIds[key] = { id: key };
    }
  }

  const statsBlock: StatsBlock | null =
    node.colapsed ? node.countSubnodesStats() : null;

  return {
    id: node.idMVC,
    idMVC: node.idMVC,
    previousIdMVC: node.previousIdMVC,
    colapsed: node.colapsed,
    subnodes,
    isLink: node.isLink || undefined,
    titleCssClass: node.titleCssClass,
    titleBackgroundCssClass: node.titleBackgroundCssClass,
    needFaviconAndTextHelperContainer:
      node.needFaviconAndTextHelperContainer || undefined,
    marks: { relicons: [] }, // View-side marks are initially empty

    // Computed fields
    customTitle: node.getCustomTitle(),
    hoveringMenuActions: actionIds,
    statsBlockData: statsBlock,
    icon: node.getIcon() ?? '',
    iconForHtmlExport: node.getIconForHtmlExport() ?? '',
    tooltipText: node.getTooltipText(),
    href: node.getHref(),
    nodeText: node.getNodeText(),
    isSelectedTab: node.isSelectedTab(),
    isFocusedWindow: node.isFocusedWindow(),
    isProtectedFromGoneOnClose: node.isProtectedFromGoneOnClose(),
    nodeContentCssClass: node.getNodeContentCssClass() ?? '',
    nodeTextCustomStyle: node.getNodeTextCustomStyle(),
    isSubnodesPresent: node.subnodes.length > 0,
  };
}

/**
 * Compute parent update data for a single node.
 */
export function computeParentUpdate(node: TreeNode): ParentUpdateData {
  return {
    isSubnodesPresent: node.subnodes.length > 0,
    isCollapsed: node.colapsed,
    subnodesStatBlock: node.colapsed ? node.countSubnodesStats() : null,
    isProtectedFromGoneOnClose: node.isProtectedFromGoneOnClose(),
    titleCssClass: node.titleCssClass,
    titleBackgroundCssClass: node.titleBackgroundCssClass,
    isSelectedTab: node.isSelectedTab(),
    isFocusedWindow: node.isFocusedWindow(),
    nodeContentCssClass: node.getNodeContentCssClass() ?? '',
  };
}

/**
 * Compute parent updates walking from node to root.
 */
export function computeParentUpdatesToRoot(node: TreeNode): ParentsUpdateData {
  const updates: ParentsUpdateData = {};
  let current: TreeNode | null = node;
  while (current) {
    updates[current.idMVC] = computeParentUpdate(current);
    current = current.parent;
  }
  return updates;
}
