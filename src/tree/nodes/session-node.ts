/**
 * SessionTreeNode — the root node of the tree.
 *
 * Port of legacy NodeSession. Manages the nextDId counter for diff
 * serialization and holds the tree identity (treeId).
 */

import { NodeTypesEnum } from '../../types/enums';
import type { SessionData } from '../../types/node-data';
import type { HoveringMenuActionId, HoveringMenuAction } from '../../types/node';
import { TreeNode } from '../tree-node';
import { GroupTreeNode } from './group-node';

/** Mutable version of SessionData for internal use. */
interface MutableSessionData {
  treeId: string;
  nextDId: number;
  nonDumpedDId: number;
}

export class SessionTreeNode extends TreeNode {
  readonly type = NodeTypesEnum.SESSION;
  readonly titleCssClass = 'session';
  readonly titleBackgroundCssClass = 'windowFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = true;

  private _persistentData: MutableSessionData;

  constructor(data?: Partial<SessionData>) {
    super();
    this._persistentData = {
      treeId: data?.treeId ?? '' + (Date.now() + Math.random()),
      nextDId: data?.nextDId ?? 1,
      nonDumpedDId: data?.nonDumpedDId ?? 1,
    };
  }

  get data(): SessionData {
    return this._persistentData;
  }

  get persistentData(): SessionData {
    return this._persistentData;
  }

  get nextDId(): number {
    return this._persistentData.nextDId;
  }

  /** Allocate the next diff ID and advance the counter. */
  allocateDId(): number {
    return this._persistentData.nextDId++;
  }

  /** Get nextDId without advancing. */
  peekNextDId(): number {
    return this._persistentData.nextDId;
  }

  /** Advance nextDId to at least the given value. */
  advanceNextDIdTo(value: number): void {
    if (value > this._persistentData.nextDId) {
      this._persistentData.nextDId = value;
    }
  }

  get treeId(): string {
    return this._persistentData.treeId;
  }

  getIcon(): string {
    return 'img/favicon.png';
  }

  getIconForHtmlExport(): string | null {
    return null;
  }

  getNodeText(): string {
    return 'Current Session';
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

  serializeData(): SessionData {
    return { ...this._persistentData };
  }

  /** Session clones as a Group (used during drag-and-drop). */
  cloneAsSaved(): TreeNode {
    const group = new GroupTreeNode();
    group.setMarks({ ...this.marks, customTitle: 'Tree' });
    return group;
  }

  protected override buildHoveringMenuActions(): Partial<
    Record<HoveringMenuActionId, HoveringMenuAction>
  > {
    // Session node only has setCursor — no delete
    return {
      setCursorAction: { id: 'setCursorAction', performAction: () => {} },
    };
  }
}
