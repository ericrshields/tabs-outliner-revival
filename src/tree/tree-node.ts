/**
 * Abstract TreeNode base class — shared operations for all tree nodes.
 *
 * Holds identity, hierarchy links, marks, diff tracking, and provides
 * concrete methods for tree navigation, stats, and serialization.
 * Each concrete node type overrides the abstract methods to supply
 * type-specific behavior (icon, text, href, serialization data, etc.).
 */

import type { MvcId } from '../types/brands';
import type { NodeType } from '../types/enums';
import { NodeTypesEnum } from '../types/enums';
import type { NodeMarks } from '../types/marks';
import type { HoveringMenuActionId, HoveringMenuAction } from '../types/node';
import type { StatsBlock } from '../types/node-dto';
import type { SerializedNode, HierarchyJSO } from '../types/serialized';
import { generateMvcId } from './mvc-id';
import type { DiffAccumulator } from './types';
import { i2s36 } from '../serialization/base36';
import {
  CDID_SDID_SEPARATOR,
  CDID_SUBNODESLIST_SEPARATOR,
  SUBNODES_DIDS_SEPARATOR,
} from '../serialization/constants';
import { encodeEntry } from '../serialization/entry-codec';
import {
  isChangesToBase,
  serializeCurSubnodes,
  getBaseSubnodesArray,
} from '../serialization/knot-codec';

export abstract class TreeNode {
  // -- Identity & state --

  idMVC: MvcId;
  previousIdMVC?: MvcId;
  abstract readonly type: NodeType;

  colapsed: boolean = false;
  marks: NodeMarks = { relicons: [] };

  parent: TreeNode | null = null;
  subnodes: TreeNode[] = [];

  /** Node difference ID — tracks structural changes */
  dId: number = 0;
  /** Content difference ID — tracks data changes */
  cdId: number = 0;
  /** Subnodes difference ID — tracks child list changes */
  sdId: number = 0;
  /** Serialized knot with dId == sdId, used as base for subnodes diff */
  sdIdKnot: string | null = null;

  readonly created: number;
  lastmod: number;
  isProtectedFromGoneOnCloseCache: boolean = false;

  constructor() {
    const now = Date.now();
    this.idMVC = generateMvcId();
    this.created = now;
    this.lastmod = now;
  }

  // -- Abstract methods (each concrete class must implement) --

  abstract get data(): unknown;
  abstract getIcon(): string | null;
  abstract getIconForHtmlExport(): string | null;
  abstract getNodeText(): string;
  abstract getTooltipText(): string;
  abstract getHref(): string | null;
  abstract getCustomTitle(): string | null;
  abstract getNodeContentCssClass(): string | null;
  abstract get titleCssClass(): string;
  abstract get titleBackgroundCssClass(): 'windowFrame' | 'tabFrame' | 'defaultFrame';
  abstract get isLink(): boolean;
  abstract get needFaviconAndTextHelperContainer(): boolean;

  /** Serialize the type-specific data payload */
  abstract serializeData(): unknown;
  /** Clone this node as its "saved" variant (for drag-and-drop copy) */
  abstract cloneAsSaved(): TreeNode;

  // -- Computed display methods --

  getNodeTextCustomStyle(): string | null {
    if (
      this.type === NodeTypesEnum.TAB ||
      this.type === NodeTypesEnum.WINDOW
    ) {
      return this.marks.customColorActive
        ? 'color:' + this.marks.customColorActive
        : null;
    }
    return this.marks.customColorSaved
      ? 'color:' + this.marks.customColorSaved
      : null;
  }

  getHoveringMenuActions(): Partial<
    Record<HoveringMenuActionId, HoveringMenuAction>
  > {
    const actions = this.buildHoveringMenuActions();

    // When collapsed and has active tabs, dynamically add close action
    if (this.colapsed && !actions.closeAction) {
      const stats = this.countSubnodesStats();
      if (stats.activeTabsCount > 0) {
        return {
          ...actions,
          closeAction: {
            id: 'closeAction',
            performAction: () => {},
          },
        };
      }
    }

    return actions;
  }

  /** Build the static set of hovering menu actions for this node type.
   *  Override in concrete classes to customize. Base provides delete + setCursor. */
  protected buildHoveringMenuActions(): Partial<
    Record<HoveringMenuActionId, HoveringMenuAction>
  > {
    return {
      deleteAction: { id: 'deleteAction', performAction: () => {} },
      setCursorAction: { id: 'setCursorAction', performAction: () => {} },
    };
  }

  // -- Tree structure operations --

  /** Insert a child node at the given index. */
  insertSubnode(index: number, child: TreeNode): void {
    const insertIndex =
      index === -1 || index > this.subnodes.length
        ? this.subnodes.length
        : index;
    this.subnodes.splice(insertIndex, 0, child);
    child.parent = this;
  }

  /** Remove this node from its parent's subnodes. */
  removeFromParent(): void {
    if (!this.parent) return;
    const idx = this.parent.subnodes.indexOf(this);
    if (idx >= 0) {
      this.parent.subnodes.splice(idx, 1);
    }
    this.parent = null;
  }

  /** Find the deepest last descendant (depth-first). */
  findLastDescendant(): TreeNode {
    if (this.subnodes.length === 0) return this;
    return this.subnodes[this.subnodes.length - 1].findLastDescendant();
  }

  // -- Navigation (visible row order, respecting collapsed state) --

  /** Previous node in display order (the row above). */
  findPrevVisible(): TreeNode | null {
    const parent = this.parent;
    if (!parent) return null;

    const ourIndex = parent.subnodes.indexOf(this);
    if (ourIndex === 0) {
      return parent;
    }
    return parent.subnodes[ourIndex - 1].findLastVisibleDescendant();
  }

  /** Next node in display order (the row below). */
  findNextVisible(): TreeNode | null {
    // If expanded and has children, next visible is first child
    if (!this.colapsed && this.subnodes.length > 0) {
      return this.subnodes[0];
    }
    return this.findNextSiblingOrAncestorSibling();
  }

  /** Find the last visible descendant (respecting collapse). */
  private findLastVisibleDescendant(): TreeNode {
    if (this.colapsed || this.subnodes.length === 0) return this;
    return this.subnodes[this.subnodes.length - 1].findLastVisibleDescendant();
  }

  /** Walk up to find next sibling of this node or any ancestor. */
  private findNextSiblingOrAncestorSibling(): TreeNode | null {
    const parent = this.parent;
    if (!parent) return null;

    const ourIndex = parent.subnodes.indexOf(this);
    if (ourIndex + 1 < parent.subnodes.length) {
      return parent.subnodes[ourIndex + 1];
    }
    return parent.findNextSiblingOrAncestorSibling();
  }

  /** Get the index path from root to this node. */
  getPathToRoot(): number[] {
    const path: number[] = [];
    let current: TreeNode = this;
    while (current.parent) {
      path.push(current.parent.subnodes.indexOf(current));
      current = current.parent;
    }
    return path.reverse();
  }

  // -- Marks --

  setMarks(marks: NodeMarks): void {
    this.marks = marks;
    this.calculateIsProtectedFromGoneOnClose();
  }

  copyMarksAndCollapsedFrom(source: TreeNode): void {
    this.marks = source.marks;
    this.colapsed = source.colapsed;
    this.calculateIsProtectedFromGoneOnClose();
  }

  // -- Stats --

  countSubnodesStats(): StatsBlock {
    const stats = { nodesCount: 0, activeWinsCount: 0, activeTabsCount: 0 };
    this.countSubnodesRecursive(stats);
    return stats;
  }

  private countSubnodesRecursive(stats: {
    nodesCount: number;
    activeWinsCount: number;
    activeTabsCount: number;
  }): void {
    for (const child of this.subnodes) {
      child.countSelf(stats);
      child.countSubnodesRecursive(stats);
    }
  }

  /** Override in active tab/window nodes to count themselves. */
  protected countSelf(stats: {
    nodesCount: number;
    activeWinsCount: number;
    activeTabsCount: number;
  }): void {
    stats.nodesCount++;
  }

  // -- Query --

  isAnOpenTab(): boolean {
    return false;
  }

  isAnOpenWindow(): boolean {
    return false;
  }

  isSelectedTab(): boolean {
    return false;
  }

  isFocusedWindow(): boolean {
    return false;
  }

  isProtectedFromGoneOnClose(): boolean {
    return this.isProtectedFromGoneOnCloseCache;
  }

  /** Recalculate the protected-from-gone-on-close state.
   *  Override in active tab/window nodes. Base always returns false. */
  calculateIsProtectedFromGoneOnClose(): boolean {
    this.isProtectedFromGoneOnCloseCache = false;
    return false;
  }

  isCustomMarksPresent(): boolean {
    return (
      this.marks.relicons.length > 0 ||
      this.marks.customFavicon !== undefined ||
      this.marks.customTitle !== undefined ||
      this.marks.customColorActive !== undefined ||
      this.marks.customColorSaved !== undefined
    );
  }

  /** Check if any direct subnode has something worth preserving
   *  (not just a single unmarked active tab). */
  isSomethingExceptUnmarkedActiveTabPresentInDirectSubnodes(): boolean {
    for (const child of this.subnodes) {
      if (child.type !== NodeTypesEnum.TAB) return true;
      if (child.isCustomMarksPresent()) return true;
      if (child.subnodes.length > 0) return true;
    }
    return false;
  }

  // -- Diff tracking --

  /** Mark this node and ancestors as changed (invalidate dIds). */
  invalidateDids(): void {
    this.dId = 0;
    this.cdId = 0;
    this.sdId = 0;
    this.sdIdKnot = null;
  }

  /** Reset dIds on this node and all descendants. */
  resetStructureDids(): void {
    this.dId = 0;
    this.cdId = 0;
    this.sdId = 0;
    this.sdIdKnot = null;
  }

  /** Reset dIds recursively on this subtree. */
  resetStructureDidsRecursive(): void {
    this.resetStructureDids();
    for (const child of this.subnodes) {
      child.resetStructureDidsRecursive();
    }
  }

  /**
   * Serialize this node for incremental diff.
   *
   * Assigns dIds from the counter, encodes entry + knot data into the accumulator.
   * Port of treemodel.js node serialization for diff system.
   */
  serializeForDiff(
    allocateDId: () => number,
    accumulator: DiffAccumulator,
  ): void {
    // Allocate content dId if needed
    if (this.cdId === 0) {
      this.cdId = allocateDId();
      const serialized = this.serialize();
      const entry = encodeEntry(serialized);
      (accumulator.entries as Map<string, string>).set(
        i2s36(this.cdId),
        JSON.stringify(entry),
      );
    }

    // Recurse into children
    for (const child of this.subnodes) {
      child.serializeForDiff(allocateDId, accumulator);
    }

    // Build subnodes dId list
    const subDids = this.subnodes.map((c) => i2s36(c.dId));

    // Check if subnodes changed from base
    const baseArray = this.sdIdKnot
      ? getBaseSubnodesArray(this.sdIdKnot)
      : [];
    const subnodesChanged =
      this.sdId === 0 || isChangesToBase(subDids, baseArray);

    if (subnodesChanged) {
      this.sdId = allocateDId();
      const changesStr = serializeCurSubnodes(subDids, baseArray);
      const knot =
        i2s36(this.cdId) +
        CDID_SUBNODESLIST_SEPARATOR +
        subDids.join(SUBNODES_DIDS_SEPARATOR);
      this.sdIdKnot = knot;

      const knotWithChanges =
        i2s36(this.cdId) +
        CDID_SDID_SEPARATOR +
        changesStr;

      (accumulator.allKnots as Map<string, string>).set(
        i2s36(this.sdId),
        knotWithChanges,
      );
    }

    // Allocate structure dId if needed
    if (this.dId === 0) {
      this.dId = allocateDId();
    }
  }

  // -- Serialization --

  /** Serialize this node to a SerializedNode for persistence.
   *  Key order matches legacy: dId, cdId, sdId, sdIdKnot, type, data, colapsed, marks */
  serialize(): SerializedNode {
    const result: Record<string, unknown> = {};

    if (this.dId) result.dId = this.dId;
    if (this.cdId) result.cdId = this.cdId;
    if (this.sdId) result.sdId = this.sdId;
    if (this.sdIdKnot) result.sdIdKnot = this.sdIdKnot;

    if (this.type !== NodeTypesEnum.SAVEDTAB) {
      result.type = this.type;
    }

    result.data = this.serializeData();

    if (this.colapsed) {
      result.colapsed = true;
    }

    // Include marks when non-empty (has keys beyond relicons, or relicons is non-empty)
    if (
      Object.keys(this.marks).length > 1 ||
      this.marks.relicons.length > 0
    ) {
      result.marks = this.marks;
    }

    return result as unknown as SerializedNode;
  }

  /** Serialize this node and all descendants as a HierarchyJSO. */
  serializeToHierarchy(): HierarchyJSO {
    const result: { n: SerializedNode; s?: HierarchyJSO[] } = {
      n: this.serialize(),
    };

    if (this.subnodes.length > 0) {
      result.s = this.subnodes.map((child) => child.serializeToHierarchy());
    }

    return result as HierarchyJSO;
  }
}
