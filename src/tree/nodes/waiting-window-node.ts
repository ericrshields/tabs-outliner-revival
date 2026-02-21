/**
 * WaitingWindowTreeNode — a window waiting to be created.
 *
 * Port of legacy NodeWindowCreationWait (commented out in legacy but
 * still needed for deserialization of existing data).
 */

import { NodeTypesEnum } from '../../types/enums';
import type { WindowData } from '../../types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '../../types/node';
import { TreeNode } from '../tree-node';
import { SavedWindowTreeNode } from './saved-window-node';
import { serializeWindowData } from './tab-utils';

export class WaitingWindowTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.WAITINGWINDOW;
  readonly titleCssClass = 'waitingwin';
  readonly titleBackgroundCssClass = 'windowFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = true;

  private _persistentData: WindowData;

  constructor(data?: WindowData) {
    super();
    this._persistentData = data ? { ...data } : ({} as WindowData);
  }

  get data(): WindowData {
    return this._persistentData;
  }

  get persistentData(): WindowData {
    return this._persistentData;
  }

  getIcon(): string {
    return this.marks.customFavicon ?? 'img/chrome-window-icon-gray.png';
  }

  getIconForHtmlExport(): string | null {
    return null;
  }

  getNodeText(): string {
    return this.marks.customTitle ?? 'Window waiting for a creation';
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

  serializeData(): WindowData {
    return serializeWindowData(this._persistentData);
  }

  cloneAsSaved(): SavedWindowTreeNode {
    const clone = new SavedWindowTreeNode(this._persistentData);
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
