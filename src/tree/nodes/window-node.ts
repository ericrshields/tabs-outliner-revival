/**
 * WindowTreeNode — an active (live) window in the tree.
 *
 * Port of legacy NodeWindowActive. Has Chrome window runtime data,
 * tracks focused state, and clones as SavedWindowTreeNode for drag-and-drop.
 */

import { NodeTypesEnum } from '@/types/enums';
import type { WindowData } from '@/types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '@/types/node';
import { TreeNode } from '../tree-node';
import { SavedWindowTreeNode } from './saved-window-node';
import { serializeWindowData } from './tab-utils';

export class WindowTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.WINDOW;
  readonly titleCssClass = 'win';
  readonly titleBackgroundCssClass = 'windowFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = true;

  private _chromeWindowObj: WindowData;
  isRelatedChromeWindowAlive: boolean = true;

  constructor(data?: WindowData) {
    super();
    this._chromeWindowObj = data ? { ...data } : ({} as WindowData);
  }

  get data(): WindowData {
    return this._chromeWindowObj;
  }

  get chromeWindowObj(): WindowData {
    return this._chromeWindowObj;
  }

  updateChromeData(newData: WindowData): void {
    this._chromeWindowObj = { ...newData };
    this.lastmod = Date.now();
  }

  getIcon(): string {
    return this.marks.customFavicon ?? 'img/chrome-window-icon-blue.png';
  }

  getIconForHtmlExport(): string | null {
    return null;
  }

  getNodeText(): string {
    return (
      this.marks.customTitle ??
      'Window' +
        (this._chromeWindowObj.type === 'normal'
          ? ''
          : ' (' + (this._chromeWindowObj.type ?? 'normal') + ')')
    );
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

  override isAnOpenWindow(): boolean {
    return true;
  }

  override isFocusedWindow(): boolean {
    return this._chromeWindowObj.focused ?? false;
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
    stats.activeWinsCount++;
  }

  serializeData(): WindowData {
    return serializeWindowData(this._chromeWindowObj);
  }

  /** Active window clones as a saved window for drag-and-drop. */
  cloneAsSaved(): SavedWindowTreeNode {
    const clone = new SavedWindowTreeNode(this._chromeWindowObj);
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
