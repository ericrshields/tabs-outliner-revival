/**
 * SavedTabTreeNode — a saved (inactive) tab in the tree.
 *
 * Port of legacy NodeTabSaved. The most common node type — when
 * serialized, the type field is omitted (default = savedtab).
 */

import { NodeTypesEnum } from '@/types/enums';
import type { TabData } from '@/types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '@/types/node';
import { TreeNode } from '../tree-node';
import { serializeTabData } from './tab-utils';

export class SavedTabTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.SAVEDTAB;
  readonly titleCssClass = 'savedtab';
  readonly titleBackgroundCssClass = 'tabFrame' as const;
  readonly isLink = true;
  readonly needFaviconAndTextHelperContainer = false;

  private _persistentData: TabData;

  constructor(data?: TabData) {
    super();
    const d = data ? { ...data } : ({} as TabData);
    // Saved tabs should not retain loading status
    if ((d as Record<string, unknown>).status === 'loading') {
      (d as Record<string, unknown>).status = 'complete';
    }
    // Don't persist windowId on saved tabs
    delete (d as Record<string, unknown>).windowId;
    this._persistentData = d;
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

  override isSelectedTab(): boolean {
    return this._persistentData.active ?? false;
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
