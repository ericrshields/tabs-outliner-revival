/**
 * GroupTreeNode — a folder/group container in the tree.
 *
 * Port of legacy NodeGroup. Uses windowFrame styling and supports
 * custom favicon/title via marks.
 */

import { NodeTypesEnum } from '@/types/enums';
import type { GroupData } from '@/types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '@/types/node';
import type { MutableStatsBlock } from '@/types/node-dto';
import { TreeNode } from '../tree-node';

export class GroupTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.GROUP;
  readonly titleCssClass = 'group';
  readonly titleBackgroundCssClass = 'windowFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = true;

  get data(): GroupData {
    return null;
  }

  getIcon(): string {
    return this.marks.customFavicon ?? 'img/group-icon.png';
  }

  getIconForHtmlExport(): string | null {
    return null;
  }

  getNodeText(): string {
    return this.marks.customTitle ?? 'Group';
  }

  getTooltipText(): string {
    return '';
  }

  getHref(): string | null {
    return null;
  }

  getCustomTitle(): string | null {
    return this.marks.customTitle ?? null;
  }

  getNodeContentCssClass(): string | null {
    return null;
  }

  protected override countSelf(stats: MutableStatsBlock): void {
    stats.nodesCount++;
    // active vs saved bucket is decided in adjustForContainerNesting
    // because it depends on whether an ancestor is already an active
    // container (one Chrome window covers the whole nested chain).
  }

  override isActiveContainer(): boolean {
    return this.hasActiveDescendant();
  }

  protected override adjustForContainerNesting(
    stats: MutableStatsBlock,
    insideActiveAncestor: boolean,
  ): void {
    // Count this group as an active container only when (a) Chrome
    // would materialize a window for it AND (b) no ancestor already
    // is one — otherwise it's the same Chrome window as its parent
    // and shouldn't double-count.
    if (this.isActiveContainer() && !insideActiveAncestor) {
      stats.activeGroupsCount++;
    } else {
      stats.savedGroupsCount++;
    }
  }

  serializeData(): GroupData {
    return null;
  }

  cloneAsSaved(): GroupTreeNode {
    const clone = new GroupTreeNode();
    clone.copyMarksAndCollapsedFrom(this);
    return clone;
  }

  protected override buildHoveringMenuActions(): Partial<
    Record<HoveringMenuActionId, HoveringMenuAction>
  > {
    return {
      ...super.buildHoveringMenuActions(),
      addNoteAction: { id: 'addNoteAction', performAction: () => {} },
      editTitleAction: { id: 'editTitleAction', performAction: () => {} },
    };
  }
}
