/**
 * TextNoteTreeNode — a text note in the tree.
 *
 * Port of legacy NodeNote. Simple leaf node with editable text content.
 */

import { NodeTypesEnum } from '../../types/enums';
import type { TextNoteData } from '../../types/node-data';
import type { NodeMarks } from '../../types/marks';
import type { HoveringMenuActionId, HoveringMenuAction } from '../../types/node';
import { TreeNode } from '../tree-node';

export class TextNoteTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.TEXTNOTE;
  readonly titleCssClass = 'textnote';
  readonly titleBackgroundCssClass = 'defaultFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = false;

  private _persistentData: TextNoteData;

  constructor(data?: TextNoteData) {
    super();
    this._persistentData = {
      note: data?.note ?? '#',
    };
  }

  get data(): TextNoteData {
    return this._persistentData;
  }

  get persistentData(): TextNoteData {
    return this._persistentData;
  }

  getIcon(): string | null {
    return null;
  }

  getIconForHtmlExport(): string | null {
    return null;
  }

  getNodeText(): string {
    return this._persistentData.note;
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

  serializeData(): TextNoteData {
    return { ...this._persistentData };
  }

  cloneAsSaved(): TextNoteTreeNode {
    const clone = new TextNoteTreeNode(this._persistentData);
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
