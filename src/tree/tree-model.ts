/**
 * TreeModel — the core tree data structure.
 *
 * Wraps a TreeNode hierarchy with O(1) indexed lookups, mutation methods
 * that return TreeMutationResult, and serialization to HierarchyJSO / diff format.
 * Pure TypeScript — no Chrome API dependencies.
 */

import type { MvcId } from '@/types/brands';
import type { NodeMarks } from '@/types/marks';
import { NodeTypesEnum } from '@/types/enums';
import type { HierarchyJSO } from '@/types/serialized';
import type { DropTarget } from '@/types/drop';
import { TreeNode } from './tree-node';
import { SessionTreeNode } from './nodes/session-node';
import { restoreTree } from './deserialize';
import type {
  TreeMutationResult,
  MutationListener,
  TreeModelOptions,
  DiffAccumulator,
} from './types';

export class TreeModel {
  readonly root: TreeNode;
  private readonly nodeIndex: Map<string, TreeNode> = new Map();
  private readonly chromeTabIndex: Map<number, TreeNode> = new Map();
  private readonly chromeWindowIndex: Map<number, TreeNode> = new Map();
  private readonly onMutation?: MutationListener;

  constructor(root: TreeNode, options?: TreeModelOptions) {
    this.root = root;
    this.onMutation = options?.onMutation;
    this.rebuildIndices();
  }

  // -- Lookup --

  findByMvcId(id: MvcId): TreeNode | null {
    return this.nodeIndex.get(id) ?? null;
  }

  findActiveTab(tabId: number): TreeNode | null {
    return this.chromeTabIndex.get(tabId) ?? null;
  }

  findActiveWindow(windowId: number): TreeNode | null {
    return this.chromeWindowIndex.get(windowId) ?? null;
  }

  getActiveWindowNodes(): TreeNode[] {
    return Array.from(this.chromeWindowIndex.values());
  }

  getAllCollapsedNodes(): TreeNode[] {
    const result: TreeNode[] = [];
    this.forEach((node) => {
      if (node.colapsed && node.subnodes.length > 0) {
        result.push(node);
      }
    });
    return result;
  }

  // -- Traversal --

  forEach(callback: (node: TreeNode) => void): void {
    const walk = (node: TreeNode): void => {
      callback(node);
      for (const child of node.subnodes) {
        walk(child);
      }
    };
    walk(this.root);
  }

  findNode(predicate: (node: TreeNode) => boolean): TreeNode | null {
    const search = (node: TreeNode): TreeNode | null => {
      if (predicate(node)) return node;
      for (const child of node.subnodes) {
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(this.root);
  }

  // -- Mutations --

  insertSubnode(
    parent: TreeNode,
    index: number,
    node: TreeNode,
  ): TreeMutationResult {
    node.resetStructureDidsRecursive();
    parent.insertSubnode(index, node);
    this.indexSubtree(node);
    parent.calculateIsProtectedFromGoneOnClose();
    this.invalidateAncestors(parent);

    const result = this.buildResult('insert', node.idMVC, parent);
    this.emitMutation(result);
    return result;
  }

  insertAsFirstChild(parent: TreeNode, node: TreeNode): TreeMutationResult {
    return this.insertSubnode(parent, 0, node);
  }

  insertAsLastChild(parent: TreeNode, node: TreeNode): TreeMutationResult {
    return this.insertSubnode(parent, -1, node);
  }

  insertBefore(ref: TreeNode, node: TreeNode): TreeMutationResult {
    const parent = ref.parent;
    if (!parent) throw new Error('Cannot insert before root');
    const idx = parent.subnodes.indexOf(ref);
    return this.insertSubnode(parent, idx, node);
  }

  insertAfter(ref: TreeNode, node: TreeNode): TreeMutationResult {
    const parent = ref.parent;
    if (!parent) throw new Error('Cannot insert after root');
    const idx = parent.subnodes.indexOf(ref);
    return this.insertSubnode(parent, idx + 1, node);
  }

  removeSubtree(node: TreeNode): TreeMutationResult {
    const parent = node.parent;
    if (!parent) throw new Error('Cannot remove root');

    // Collect all MvcIds before detaching
    const deletedIds: MvcId[] = [];
    this.forEachInSubtree(node, (n) => deletedIds.push(n.idMVC));

    // Suggest cursor: next sibling, or previous sibling, or parent
    const sibIdx = parent.subnodes.indexOf(node);
    let cursorSuggestion: MvcId | undefined;
    if (sibIdx + 1 < parent.subnodes.length) {
      cursorSuggestion = parent.subnodes[sibIdx + 1].idMVC;
    } else if (sibIdx > 0) {
      cursorSuggestion = parent.subnodes[sibIdx - 1].idMVC;
    } else {
      cursorSuggestion = parent.idMVC;
    }

    node.removeFromParent();
    this.unindexSubtree(deletedIds);
    parent.calculateIsProtectedFromGoneOnClose();
    this.invalidateAncestors(parent);

    const result: TreeMutationResult = {
      ...this.buildResult('delete', node.idMVC, parent),
      deletedNodeIds: deletedIds,
      cursorSuggestion,
    };
    this.emitMutation(result);
    return result;
  }

  moveNode(source: TreeNode, target: DropTarget): TreeMutationResult {
    const oldParent = source.parent;
    if (!oldParent) throw new Error('Cannot move root');

    // Clone a new identity for the moved node
    source.removeFromParent();
    this.unindexNode(source);

    const container = target.containerIdMVC
      ? this.findByMvcId(target.containerIdMVC as MvcId)
      : this.root;
    if (!container) throw new Error('Drop target container not found');

    source.resetStructureDidsRecursive();
    container.insertSubnode(target.position, source);
    this.indexSubtree(source);

    oldParent.calculateIsProtectedFromGoneOnClose();
    container.calculateIsProtectedFromGoneOnClose();
    this.invalidateAncestors(oldParent);
    this.invalidateAncestors(container);

    const result = this.buildResult('move', source.idMVC, container);
    this.emitMutation(result);
    return result;
  }

  setCollapsed(node: TreeNode, collapsed: boolean): TreeMutationResult {
    // Don't allow collapsing empty nodes
    if (node.subnodes.length === 0) {
      node.colapsed = false;
    } else {
      node.colapsed = collapsed;
    }
    this.invalidateAncestors(node);

    const result = this.buildResult(
      'collapse',
      node.idMVC,
      node.parent ?? node,
    );
    this.emitMutation(result);
    return result;
  }

  setMarks(node: TreeNode, marks: NodeMarks): TreeMutationResult {
    node.setMarks(marks);
    this.invalidateAncestors(node);

    const result = this.buildResult(
      'update',
      node.idMVC,
      node.parent ?? node,
    );
    this.emitMutation(result);
    return result;
  }

  replaceNode(oldNode: TreeNode, newNode: TreeNode): TreeMutationResult {
    const parent = oldNode.parent;
    if (!parent) throw new Error('Cannot replace root');

    const idx = parent.subnodes.indexOf(oldNode);
    newNode.previousIdMVC = oldNode.idMVC;

    // Transfer children
    while (oldNode.subnodes.length > 0) {
      const child = oldNode.subnodes[0];
      child.removeFromParent();
      newNode.insertSubnode(-1, child);
    }

    oldNode.removeFromParent();
    this.unindexNode(oldNode);

    newNode.resetStructureDidsRecursive();
    parent.insertSubnode(idx, newNode);
    this.indexSubtree(newNode);

    parent.calculateIsProtectedFromGoneOnClose();
    this.invalidateAncestors(parent);

    const result: TreeMutationResult = {
      ...this.buildResult('replace', newNode.idMVC, parent),
      cursorSuggestion: newNode.idMVC,
    };
    this.emitMutation(result);
    return result;
  }

  // -- Serialization --

  toHierarchyJSO(): HierarchyJSO {
    return this.root.serializeToHierarchy();
  }

  serializeForDiff(startingDId: number): DiffAccumulator {
    const session = this.root as SessionTreeNode;
    if (session.advanceNextDIdTo) {
      session.advanceNextDIdTo(startingDId);
    }

    const accumulator: DiffAccumulator = {
      allKnots: new Map(),
      entries: new Map(),
      rootDid: '',
    };

    const allocate = (): number => {
      if (session.allocateDId) {
        return session.allocateDId();
      }
      return startingDId++;
    };

    this.root.serializeForDiff(allocate, accumulator);

    // Set the root dId as the rootDid
    (accumulator as { rootDid: string }).rootDid =
      this.root.dId.toString(36);

    return accumulator;
  }

  getNextDId(): number {
    const session = this.root as SessionTreeNode;
    return session.peekNextDId ? session.peekNextDId() : 0;
  }

  // -- Static factories --

  static fromHierarchyJSO(
    jso: HierarchyJSO,
    options?: TreeModelOptions,
  ): TreeModel {
    const root = restoreTree(jso);
    if (!root) {
      throw new Error('Failed to restore tree from HierarchyJSO');
    }
    return new TreeModel(root, options);
  }

  static createEmpty(options?: TreeModelOptions): TreeModel {
    return new TreeModel(new SessionTreeNode(), options);
  }

  // -- Private helpers --

  private rebuildIndices(): void {
    this.nodeIndex.clear();
    this.chromeTabIndex.clear();
    this.chromeWindowIndex.clear();
    this.forEach((node) => this.indexNode(node));
  }

  private indexNode(node: TreeNode): void {
    this.nodeIndex.set(node.idMVC, node);

    // Index active tabs/windows by Chrome ID
    if (
      node.type === NodeTypesEnum.TAB ||
      node.type === NodeTypesEnum.ATTACHWAITINGTAB
    ) {
      const data = node.data as { id?: number };
      if (data?.id !== undefined) {
        this.chromeTabIndex.set(data.id, node);
      }
    } else if (node.type === NodeTypesEnum.WINDOW) {
      const data = node.data as { id?: number };
      if (data?.id !== undefined) {
        this.chromeWindowIndex.set(data.id, node);
      }
    }
  }

  private unindexNode(node: TreeNode): void {
    this.nodeIndex.delete(node.idMVC);

    if (
      node.type === NodeTypesEnum.TAB ||
      node.type === NodeTypesEnum.ATTACHWAITINGTAB
    ) {
      const data = node.data as { id?: number };
      if (data?.id !== undefined) {
        this.chromeTabIndex.delete(data.id);
      }
    } else if (node.type === NodeTypesEnum.WINDOW) {
      const data = node.data as { id?: number };
      if (data?.id !== undefined) {
        this.chromeWindowIndex.delete(data.id);
      }
    }
  }

  private indexSubtree(node: TreeNode): void {
    this.forEachInSubtree(node, (n) => this.indexNode(n));
  }

  private unindexSubtree(ids: MvcId[]): void {
    for (const id of ids) {
      const node = this.nodeIndex.get(id);
      if (node) this.unindexNode(node);
    }
  }

  private forEachInSubtree(
    node: TreeNode,
    callback: (n: TreeNode) => void,
  ): void {
    callback(node);
    for (const child of node.subnodes) {
      this.forEachInSubtree(child, callback);
    }
  }

  private invalidateAncestors(node: TreeNode): void {
    let current: TreeNode | null = node;
    while (current) {
      current.invalidateDids();
      current = current.parent;
    }
  }

  private buildResult(
    type: TreeMutationResult['type'],
    affectedNodeId: MvcId,
    parentNode: TreeNode,
  ): TreeMutationResult {
    // Compute parent updates up to root
    const parentUpdates: Record<string, unknown> = {};
    let current: TreeNode | null = parentNode;
    while (current) {
      parentUpdates[current.idMVC] = {
        isSubnodesPresent: current.subnodes.length > 0,
        isCollapsed: current.colapsed,
        subnodesStatBlock:
          current.colapsed ? current.countSubnodesStats() : null,
        isProtectedFromGoneOnClose: current.isProtectedFromGoneOnClose(),
        titleCssClass: current.titleCssClass,
        titleBackgroundCssClass: current.titleBackgroundCssClass,
        isSelectedTab: current.isSelectedTab(),
        isFocusedWindow: current.isFocusedWindow(),
        nodeContentCssClass: current.getNodeContentCssClass(),
      };
      current = current.parent;
    }

    return {
      type,
      affectedNodeId,
      parentUpdates: parentUpdates as TreeMutationResult['parentUpdates'],
    };
  }

  private emitMutation(result: TreeMutationResult): void {
    if (this.onMutation) {
      this.onMutation(result);
    }
  }
}
