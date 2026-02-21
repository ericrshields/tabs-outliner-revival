/**
 * GroupTreeNode — a folder/group container in the tree.
 *
 * Port of legacy NodeGroup. Uses windowFrame styling and supports
 * custom favicon/title via marks.
 */

import { NodeTypesEnum } from '../../types/enums';
import type { GroupData } from '../../types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '../../types/node';
import { TreeNode } from '../tree-node';

export class GroupTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.GROUP;
  readonly titleCssClass = 'group';
  readonly titleBackgroundCssClass = 'windowFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = true;

  constructor() {
    super();
  }

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
    return null;
  }

  getNodeContentCssClass(): string | null {
    return null;
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
      editTitleAction: { id: 'editTitleAction', performAction: () => {} },
    };
  }
}
