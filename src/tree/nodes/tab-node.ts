/**
 * TabTreeNode — an active (live) tab in the tree.
 *
 * Port of legacy NodeTabActive. Has Chrome tab runtime data and
 * tracks active/selected state. Clones as SavedTabTreeNode for drag-and-drop.
 */

import { NodeTypesEnum } from '@/types/enums';
import type { TabData } from '@/types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '@/types/node';
import { TreeNode } from '../tree-node';
import { SavedTabTreeNode } from './saved-tab-node';
import { serializeTabData } from './tab-utils';

export class TabTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.TAB;
  readonly titleCssClass = 'tab';
  readonly titleBackgroundCssClass = 'tabFrame' as const;
  readonly isLink = true;
  readonly needFaviconAndTextHelperContainer = false;

  /**
   * Set by handleActivateNode when a saved tab is opened. Tells
   * handleTabRemoved to convert back to saved instead of removing.
   * Not serialized — crash recovery already converts stale active tabs.
   */
  restoredFromSaved = false;

  private _chromeTabObj: TabData;

  constructor(data?: TabData) {
    super();
    this._chromeTabObj = data ? { ...data } : ({} as TabData);
  }

  get data(): TabData {
    return this._chromeTabObj;
  }

  get chromeTabObj(): TabData {
    return this._chromeTabObj;
  }

  /** Update the live Chrome tab data. */
  updateChromeData(newData: TabData): void {
    this._chromeTabObj = { ...newData };
    this.lastmod = Date.now();
  }

  getIcon(): string {
    if (this._chromeTabObj.status === 'loading') {
      return 'img/loading.gif';
    }
    return this._chromeTabObj.favIconUrl
      ?? ('img/chromeFavicon.png');
  }

  getIconForHtmlExport(): string | null {
    return this._chromeTabObj.favIconUrl ?? null;
  }

  getNodeText(): string {
    return this._chromeTabObj.title ?? '';
  }

  getTooltipText(): string {
    return '';
  }

  getHref(): string | null {
    return this._chromeTabObj.url ?? null;
  }

  getCustomTitle(): string | null {
    return this.marks.customTitle ?? null;
  }

  getNodeContentCssClass(): string | null {
    return null;
  }

  override isAnOpenTab(): boolean {
    return true;
  }

  override isSelectedTab(): boolean {
    return this._chromeTabObj.active ?? false;
  }

  override calculateIsProtectedFromGoneOnClose(): boolean {
    this.isProtectedFromGoneOnCloseCache =
      this.isCustomMarksPresent() ||
      this.isSomethingExceptUnmarkedActiveTabPresentInDirectSubnodes();
    return this.isProtectedFromGoneOnCloseCache;
  }

  protected override countSelf(stats: {
    nodesCount: number;
    activeWinsCount: number;
    activeTabsCount: number;
  }): void {
    stats.nodesCount++;
    stats.activeTabsCount++;
  }

  serializeData(): TabData {
    return serializeTabData(this._chromeTabObj);
  }

  /** Active tab clones as a saved tab for drag-and-drop. */
  cloneAsSaved(): SavedTabTreeNode {
    const clone = new SavedTabTreeNode(this._chromeTabObj);
    clone.copyMarksAndCollapsedFrom(this);
    return clone;
  }

  protected override buildHoveringMenuActions(): Partial<
    Record<HoveringMenuActionId, HoveringMenuAction>
  > {
    return {
      ...super.buildHoveringMenuActions(),
      editTitleAction: { id: 'editTitleAction', performAction: () => {} },
      closeAction: { id: 'closeAction', performAction: () => {} },
    };
  }
}
