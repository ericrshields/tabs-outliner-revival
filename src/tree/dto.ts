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
 * `subnodes: []` with `_countSubnodesStatsBlockData` populated.
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
    _getCustomTitle: node.getCustomTitle(),
    _hoveringMenuActions: actionIds,
    _countSubnodesStatsBlockData: statsBlock,
    _getIcon: node.getIcon() ?? '',
    _getIconForHtmlExport: node.getIconForHtmlExport() ?? '',
    _getTooltipText: node.getTooltipText(),
    _getHref: node.getHref(),
    _getNodeText: node.getNodeText(),
    _isSelectedTab: node.isSelectedTab(),
    _isFocusedWindow: node.isFocusedWindow(),
    _isProtectedFromGoneOnClose: node.isProtectedFromGoneOnClose(),
    _getNodeContentCssClass: node.getNodeContentCssClass() ?? '',
    _getNodeTextCustomStyle: node.getNodeTextCustomStyle(),
    _isSubnodesPresent: node.subnodes.length > 0,
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
    _isSelectedTab: node.isSelectedTab(),
    _isFocusedWindow: node.isFocusedWindow(),
    _getNodeContentCssClass: node.getNodeContentCssClass() ?? '',
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
