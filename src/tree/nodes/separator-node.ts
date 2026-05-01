/**
 * SeparatorTreeNode — a visual separator line in the tree.
 *
 * Port of legacy NodeSeparatorLine. Three separator styles available,
 * cycled via double-click (editTitle action).
 */

import { NodeTypesEnum } from '@/types/enums';
import type { SeparatorData } from '@/types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '@/types/node';
import type { MutableStatsBlock } from '@/types/node-dto';
import { TreeNode } from '../tree-node';

const SEPARATORS = [
  {
    text: '------------------------------------------------------------------------------------------------------',
    css: 'b',
  },
  {
    text: '==========================================================',
    css: 'a',
  },
  {
    text: '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ',
    css: 'c',
  },
] as const;

export class SeparatorTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.SEPARATORLINE;
  readonly titleCssClass = 'separatorline';
  readonly titleBackgroundCssClass = 'defaultFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = false;

  private _persistentData: SeparatorData;

  constructor(data?: SeparatorData) {
    super();
    this._persistentData = {
      separatorIndx: data?.separatorIndx ?? 0,
    };
  }

  get data(): SeparatorData {
    return this._persistentData;
  }

  get persistentData(): SeparatorData {
    return this._persistentData;
  }

  getIcon(): string | null {
    return null;
  }

  getIconForHtmlExport(): string | null {
    return null;
  }

  getNodeText(): string {
    return SEPARATORS[this._persistentData.separatorIndx].text;
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

  /** Cycle to the next separator style (0 → 1 → 2 → 0). */
  cycleStyle(): void {
    this._persistentData = {
      separatorIndx: ((this._persistentData.separatorIndx + 1) % 3) as
        | 0
        | 1
        | 2,
    };
  }

  getNodeContentCssClass(): string {
    return SEPARATORS[this._persistentData.separatorIndx].css;
  }

  protected override countSelf(stats: MutableStatsBlock): void {
    stats.nodesCount++;
    stats.separatorsCount++;
  }

  serializeData(): SeparatorData {
    return { ...this._persistentData };
  }

  cloneAsSaved(): SeparatorTreeNode {
    const clone = new SeparatorTreeNode(this._persistentData);
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
