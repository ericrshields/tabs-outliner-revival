import { describe, it, expect, beforeEach } from 'vitest';
import { TreeNode } from '../tree-node';
import { NodeTypesEnum } from '../../types/enums';
import type { NodeType } from '../../types/enums';
import type { NodeMarks } from '../../types/marks';
import { resetMvcIdCounter } from '../mvc-id';

/** Minimal concrete subclass for testing TreeNode base behavior. */
class TestNode extends TreeNode {
  readonly type: NodeType = NodeTypesEnum.SAVEDTAB;
  readonly titleCssClass = 'savedtab';
  readonly titleBackgroundCssClass = 'tabFrame' as const;
  readonly isLink = false;
  readonly needFaviconAndTextHelperContainer = false;

  private _data: unknown;

  constructor(data: unknown = null) {
    super();
    this._data = data;
  }

  get data(): unknown {
    return this._data;
  }
  getIcon(): string | null {
    return null;
  }
  getIconForHtmlExport(): string | null {
    return null;
  }
  getNodeText(): string {
    return 'test';
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
  serializeData(): unknown {
    return this._data;
  }
  cloneAsSaved(): TreeNode {
    const clone = new TestNode(this._data);
    clone.copyMarksAndCollapsedFrom(this);
    return clone;
  }
}

/** Active tab test node for stats counting. */
class TestActiveTabNode extends TestNode {
  override readonly type: NodeType = NodeTypesEnum.TAB;

  override isAnOpenTab(): boolean {
    return true;
  }

  protected override countSelf(stats: {
    nodesCount: number;
    activeWinsCount: number;
    activeTabsCount: number;
  }): void {
    stats.nodesCount++;
    stats.activeTabsCount++;
  }
}

/** Active window test node for stats counting. */
class TestActiveWindowNode extends TestNode {
  override readonly type: NodeType = NodeTypesEnum.WINDOW;

  override isAnOpenWindow(): boolean {
    return true;
  }

  protected override countSelf(stats: {
    nodesCount: number;
    activeWinsCount: number;
    activeTabsCount: number;
  }): void {
    stats.nodesCount++;
    stats.activeWinsCount++;
  }
}

describe('TreeNode', () => {
  beforeEach(() => {
    resetMvcIdCounter();
  });

  describe('constructor', () => {
    it('assigns a unique MvcId', () => {
      const a = new TestNode();
      const b = new TestNode();
      expect(a.idMVC).toBe('idmvc1');
      expect(b.idMVC).toBe('idmvc2');
    });

    it('initializes with default state', () => {
      const node = new TestNode();
      expect(node.colapsed).toBe(false);
      expect(node.marks).toEqual({ relicons: [] });
      expect(node.parent).toBeNull();
      expect(node.subnodes).toEqual([]);
      expect(node.dId).toBe(0);
      expect(node.cdId).toBe(0);
      expect(node.sdId).toBe(0);
      expect(node.sdIdKnot).toBeNull();
      expect(node.isProtectedFromGoneOnCloseCache).toBe(false);
      expect(node.created).toBeGreaterThan(0);
      expect(node.lastmod).toBeGreaterThan(0);
    });
  });

  describe('insertSubnode', () => {
    it('inserts child at specified index', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const b = new TestNode();
      const c = new TestNode();

      parent.insertSubnode(0, a);
      parent.insertSubnode(0, b); // b goes before a
      parent.insertSubnode(1, c); // c between b and a

      expect(parent.subnodes).toEqual([b, c, a]);
      expect(a.parent).toBe(parent);
      expect(b.parent).toBe(parent);
      expect(c.parent).toBe(parent);
    });

    it('appends when index is -1', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const b = new TestNode();

      parent.insertSubnode(-1, a);
      parent.insertSubnode(-1, b);

      expect(parent.subnodes).toEqual([a, b]);
    });

    it('appends when index exceeds length', () => {
      const parent = new TestNode();
      const a = new TestNode();

      parent.insertSubnode(999, a);

      expect(parent.subnodes).toEqual([a]);
    });
  });

  describe('removeFromParent', () => {
    it('removes node from parent subnodes', () => {
      const parent = new TestNode();
      const child = new TestNode();
      parent.insertSubnode(0, child);

      child.removeFromParent();

      expect(parent.subnodes).toEqual([]);
      expect(child.parent).toBeNull();
    });

    it('does nothing when node has no parent', () => {
      const node = new TestNode();
      node.removeFromParent(); // should not throw
      expect(node.parent).toBeNull();
    });
  });

  describe('findLastDescendant', () => {
    it('returns self for leaf node', () => {
      const node = new TestNode();
      expect(node.findLastDescendant()).toBe(node);
    });

    it('returns deepest last child', () => {
      const root = new TestNode();
      const a = new TestNode();
      const b = new TestNode();
      const c = new TestNode();
      root.insertSubnode(0, a);
      root.insertSubnode(1, b);
      b.insertSubnode(0, c);

      expect(root.findLastDescendant()).toBe(c);
    });
  });

  describe('findPrevVisible', () => {
    it('returns null for root', () => {
      const root = new TestNode();
      expect(root.findPrevVisible()).toBeNull();
    });

    it('returns parent when first child', () => {
      const parent = new TestNode();
      const child = new TestNode();
      parent.insertSubnode(0, child);

      expect(child.findPrevVisible()).toBe(parent);
    });

    it('returns previous sibling when leaf', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const b = new TestNode();
      parent.insertSubnode(0, a);
      parent.insertSubnode(1, b);

      expect(b.findPrevVisible()).toBe(a);
    });

    it('returns last visible descendant of previous sibling', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const a1 = new TestNode();
      const b = new TestNode();
      parent.insertSubnode(0, a);
      a.insertSubnode(0, a1);
      parent.insertSubnode(1, b);

      expect(b.findPrevVisible()).toBe(a1);
    });

    it('respects collapsed state of previous sibling', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const a1 = new TestNode();
      const b = new TestNode();
      parent.insertSubnode(0, a);
      a.insertSubnode(0, a1);
      a.colapsed = true;
      parent.insertSubnode(1, b);

      expect(b.findPrevVisible()).toBe(a); // a is collapsed, so a1 is hidden
    });
  });

  describe('findNextVisible', () => {
    it('returns first child when expanded', () => {
      const parent = new TestNode();
      const child = new TestNode();
      parent.insertSubnode(0, child);

      expect(parent.findNextVisible()).toBe(child);
    });

    it('returns next sibling when leaf', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const b = new TestNode();
      parent.insertSubnode(0, a);
      parent.insertSubnode(1, b);

      expect(a.findNextVisible()).toBe(b);
    });

    it('skips children when collapsed', () => {
      const parent = new TestNode();
      const a = new TestNode();
      const a1 = new TestNode();
      const b = new TestNode();
      parent.insertSubnode(0, a);
      a.insertSubnode(0, a1);
      a.colapsed = true;
      parent.insertSubnode(1, b);

      expect(a.findNextVisible()).toBe(b);
    });

    it('returns parents next sibling when last child', () => {
      const root = new TestNode();
      const a = new TestNode();
      const a1 = new TestNode();
      const b = new TestNode();
      root.insertSubnode(0, a);
      a.insertSubnode(0, a1);
      root.insertSubnode(1, b);

      expect(a1.findNextVisible()).toBe(b);
    });

    it('returns null at end of tree', () => {
      const root = new TestNode();
      const a = new TestNode();
      root.insertSubnode(0, a);

      expect(a.findNextVisible()).toBeNull();
    });
  });

  describe('getPathToRoot', () => {
    it('returns empty array for root', () => {
      const root = new TestNode();
      expect(root.getPathToRoot()).toEqual([]);
    });

    it('returns correct index path', () => {
      const root = new TestNode();
      const a = new TestNode();
      const b = new TestNode();
      const b1 = new TestNode();
      root.insertSubnode(0, a);
      root.insertSubnode(1, b);
      b.insertSubnode(0, b1);

      expect(b1.getPathToRoot()).toEqual([1, 0]); // root[1] -> b[0] -> b1
    });
  });

  describe('marks', () => {
    it('setMarks replaces marks', () => {
      const node = new TestNode();
      const newMarks: NodeMarks = {
        relicons: [],
        customTitle: 'Custom',
      };
      node.setMarks(newMarks);
      expect(node.marks).toBe(newMarks);
    });

    it('copyMarksAndCollapsedFrom copies marks and collapsed', () => {
      const source = new TestNode();
      source.marks = { relicons: [], customTitle: 'Source' };
      source.colapsed = true;

      const target = new TestNode();
      target.copyMarksAndCollapsedFrom(source);

      expect(target.marks).toBe(source.marks);
      expect(target.colapsed).toBe(true);
    });
  });

  describe('countSubnodesStats', () => {
    it('returns zeros for leaf node', () => {
      const node = new TestNode();
      expect(node.countSubnodesStats()).toEqual({
        nodesCount: 0,
        activeWinsCount: 0,
        activeTabsCount: 0,
      });
    });

    it('counts all descendant types', () => {
      const root = new TestNode();
      const tab1 = new TestActiveTabNode();
      const tab2 = new TestActiveTabNode();
      const win = new TestActiveWindowNode();
      const saved = new TestNode();

      root.insertSubnode(0, win);
      win.insertSubnode(0, tab1);
      win.insertSubnode(1, tab2);
      root.insertSubnode(1, saved);

      const stats = root.countSubnodesStats();
      expect(stats.nodesCount).toBe(4); // win + tab1 + tab2 + saved
      expect(stats.activeTabsCount).toBe(2);
      expect(stats.activeWinsCount).toBe(1);
    });
  });

  describe('query methods', () => {
    it('base isAnOpenTab returns false', () => {
      expect(new TestNode().isAnOpenTab()).toBe(false);
    });

    it('base isAnOpenWindow returns false', () => {
      expect(new TestNode().isAnOpenWindow()).toBe(false);
    });

    it('base isSelectedTab returns false', () => {
      expect(new TestNode().isSelectedTab()).toBe(false);
    });

    it('base isFocusedWindow returns false', () => {
      expect(new TestNode().isFocusedWindow()).toBe(false);
    });
  });

  describe('isCustomMarksPresent', () => {
    it('returns false for default marks', () => {
      expect(new TestNode().isCustomMarksPresent()).toBe(false);
    });

    it('returns true with relicons', () => {
      const node = new TestNode();
      node.marks = { relicons: [{ src: 'x', w: 1, h: 1 }] };
      expect(node.isCustomMarksPresent()).toBe(true);
    });

    it('returns true with customTitle', () => {
      const node = new TestNode();
      node.marks = { relicons: [], customTitle: 'Custom' };
      expect(node.isCustomMarksPresent()).toBe(true);
    });
  });

  describe('getNodeTextCustomStyle', () => {
    it('returns null when no custom colors', () => {
      const node = new TestNode();
      expect(node.getNodeTextCustomStyle()).toBeNull();
    });

    it('uses customColorSaved for non-active types', () => {
      const node = new TestNode();
      node.marks = { relicons: [], customColorSaved: '#ff0000' };
      expect(node.getNodeTextCustomStyle()).toBe('color:#ff0000');
    });

    it('uses customColorActive for TAB type', () => {
      const node = new TestActiveTabNode();
      node.marks = {
        relicons: [],
        customColorActive: '#00ff00',
        customColorSaved: '#ff0000',
      };
      expect(node.getNodeTextCustomStyle()).toBe('color:#00ff00');
    });
  });

  describe('getHoveringMenuActions', () => {
    it('includes delete and setCursor by default', () => {
      const node = new TestNode();
      const actions = node.getHoveringMenuActions();
      expect(actions.deleteAction).toBeDefined();
      expect(actions.setCursorAction).toBeDefined();
    });

    it('adds closeAction when collapsed with active tabs', () => {
      const parent = new TestNode();
      const tab = new TestActiveTabNode();
      parent.insertSubnode(0, tab);
      parent.colapsed = true;

      const actions = parent.getHoveringMenuActions();
      expect(actions.closeAction).toBeDefined();
    });

    it('does not add closeAction when collapsed without active tabs', () => {
      const parent = new TestNode();
      const saved = new TestNode();
      parent.insertSubnode(0, saved);
      parent.colapsed = true;

      const actions = parent.getHoveringMenuActions();
      expect(actions.closeAction).toBeUndefined();
    });
  });

  describe('diff tracking', () => {
    it('invalidateDids resets all dIds', () => {
      const node = new TestNode();
      node.dId = 5;
      node.cdId = 6;
      node.sdId = 7;
      node.sdIdKnot = 'knot';

      node.invalidateDids();

      expect(node.dId).toBe(0);
      expect(node.cdId).toBe(0);
      expect(node.sdId).toBe(0);
      expect(node.sdIdKnot).toBeNull();
    });

    it('resetStructureDidsRecursive resets entire subtree', () => {
      const parent = new TestNode();
      const child = new TestNode();
      parent.insertSubnode(0, child);
      parent.dId = 5;
      child.dId = 6;

      parent.resetStructureDidsRecursive();

      expect(parent.dId).toBe(0);
      expect(child.dId).toBe(0);
    });
  });

  describe('serialize', () => {
    it('produces minimal output for default savedtab', () => {
      const node = new TestNode({ url: 'https://example.com' });
      const result = node.serialize();

      // type omitted for savedtab
      expect(result.type).toBeUndefined();
      expect(result.data).toEqual({ url: 'https://example.com' });
      expect(result.marks).toBeUndefined();
      expect(result.colapsed).toBeUndefined();
    });

    it('includes type for non-savedtab nodes', () => {
      const node = new TestActiveTabNode();
      const result = node.serialize();
      expect(result.type).toBe('tab');
    });

    it('includes marks when non-empty', () => {
      const node = new TestNode();
      node.marks = { relicons: [{ src: 'img/x.png', w: 16, h: 16 }] };
      const result = node.serialize();
      expect(result.marks).toEqual({
        relicons: [{ src: 'img/x.png', w: 16, h: 16 }],
      });
    });

    it('includes collapsed when true', () => {
      const node = new TestNode();
      node.colapsed = true;
      const result = node.serialize();
      expect(result.colapsed).toBe(true);
    });

    it('includes dId fields when non-zero', () => {
      const node = new TestNode();
      node.dId = 10;
      node.cdId = 11;
      node.sdId = 12;
      node.sdIdKnot = 'knot-value';

      const result = node.serialize();
      expect(result.dId).toBe(10);
      expect(result.cdId).toBe(11);
      expect(result.sdId).toBe(12);
      expect(result.sdIdKnot).toBe('knot-value');
    });
  });

  describe('serializeToHierarchy', () => {
    it('serializes leaf node', () => {
      const node = new TestNode('data');
      const h = node.serializeToHierarchy();
      expect(h.n.data).toBe('data');
      expect(h.s).toBeUndefined();
    });

    it('serializes node with children', () => {
      const parent = new TestNode('parent');
      const child = new TestNode('child');
      parent.insertSubnode(0, child);

      const h = parent.serializeToHierarchy();
      expect(h.s).toHaveLength(1);
      expect(h.s![0].n.data).toBe('child');
    });
  });
});
