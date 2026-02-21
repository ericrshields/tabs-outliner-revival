/**
 * SavedWindowTreeNode — a saved (inactive) window in the tree.
 *
 * Port of legacy NodeWindowSaved. Displays close/crash dates in title.
 */

import { NodeTypesEnum } from '../../types/enums';
import type { WindowData } from '../../types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '../../types/node';
import { TreeNode } from '../tree-node';
import { serializeWindowData } from './tab-utils';

export class SavedWindowTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.SAVEDWINDOW;
  readonly titleCssClass = 'savedwin';
  readonly titleBackgroundCssClass = 'windowFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = true;

  private _persistentData: WindowData;
  additionalTextCss?: string;

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
    let text = this.marks.customTitle ?? 'Window';

    if (this._persistentData.closeDate) {
      text +=
        ' (closed ' +
        new Date(this._persistentData.closeDate).toDateString() +
        ')';
    }
    if (this._persistentData.crashDetectedDate) {
      text +=
        ' (crashed ' +
        new Date(this._persistentData.crashDetectedDate).toDateString() +
        ')';
    }

    return text;
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
