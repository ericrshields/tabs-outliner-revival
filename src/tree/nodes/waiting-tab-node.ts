/**
 * WaitingTabTreeNode — a tab waiting to be created.
 *
 * Port of legacy NodeTabCreationWait (commented out in legacy but
 * still needed for deserialization of existing data).
 */

import { NodeTypesEnum } from '@/types/enums';
import type { TabData } from '@/types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '@/types/node';
import { TreeNode } from '../tree-node';
import { SavedTabTreeNode } from './saved-tab-node';
import { serializeTabData } from './tab-utils';

export class WaitingTabTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.WAITINGTAB;
  readonly titleCssClass = 'waitingtab';
  readonly titleBackgroundCssClass = 'tabFrame' as const;
  readonly isLink = true;
  readonly needFaviconAndTextHelperContainer = false;

  private _persistentData: TabData;

  constructor(data?: TabData) {
    super();
    this._persistentData = data ? { ...data } : ({} as TabData);
  }

  get data(): TabData {
    return this._persistentData;
  }

  get persistentData(): TabData {
    return this._persistentData;
  }

  getIcon(): string {
    if (this._persistentData.status === 'loading') {
      return 'img/loading.gif';
    }
    return this._persistentData.favIconUrl
      ?? ('chrome-extension://__MSG_@@extension_id__/img/chromeFavicon.png');
  }

  getIconForHtmlExport(): string | null {
    return this._persistentData.favIconUrl ?? null;
  }

  getNodeText(): string {
    return this._persistentData.title ?? '';
  }

  getTooltipText(): string {
    return '';
  }

  getHref(): string | null {
    return this._persistentData.url ?? null;
  }

  getCustomTitle(): string | null {
    return this.marks.customTitle ?? null;
  }

  getNodeContentCssClass(): string | null {
    return null;
  }

  serializeData(): TabData {
    return serializeTabData(this._persistentData);
  }

  cloneAsSaved(): SavedTabTreeNode {
    const clone = new SavedTabTreeNode(this._persistentData);
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
