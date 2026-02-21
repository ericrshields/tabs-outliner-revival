import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeModel } from '../tree-model';
import { TreeNode } from '../tree-node';
import { SessionTreeNode } from '../nodes/session-node';
import { SavedTabTreeNode } from '../nodes/saved-tab-node';
import { TabTreeNode } from '../nodes/tab-node';
import { WindowTreeNode } from '../nodes/window-node';
import { SavedWindowTreeNode } from '../nodes/saved-window-node';
import { GroupTreeNode } from '../nodes/group-node';
import { TextNoteTreeNode } from '../nodes/text-note-node';
import { NodeTypesEnum } from '../../types/enums';
import type { HierarchyJSO } from '../../types/serialized';
import type { MvcId } from '../../types/brands';
import type { TreeMutationResult } from '../types';
import { resetMvcIdCounter } from '../mvc-id';

function createTestTree(): TreeModel {
  const session = new SessionTreeNode({ treeId: 't', nextDId: 1, nonDumpedDId: 1 });
  const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
  const tab1 = new TabTreeNode({ id: 101, windowId: 1, url: 'https://a.com', title: 'A', active: true });
  const tab2 = new TabTreeNode({ id: 102, windowId: 1, url: 'https://b.com', title: 'B' });
  const savedWin = new SavedWindowTreeNode({ id: 2 });
  const savedTab = new SavedTabTreeNode({ url: 'https://c.com', title: 'C' });

  session.insertSubnode(0, win);
  win.insertSubnode(0, tab1);
  win.insertSubnode(1, tab2);
  session.insertSubnode(1, savedWin);
  savedWin.insertSubnode(0, savedTab);

  return new TreeModel(session);
}

describe('TreeModel', () => {
  beforeEach(() => resetMvcIdCounter());

  describe('constructor and indices', () => {
    it('indexes all nodes by MvcId', () => {
      const model = createTestTree();
      let count = 0;
      model.forEach(() => count++);
      expect(count).toBe(6); // session + win + tab1 + tab2 + savedWin + savedTab
    });

    it('findByMvcId returns correct node', () => {
      const model = createTestTree();
      const root = model.root;
      expect(model.findByMvcId(root.idMVC)).toBe(root);
    });

    it('findByMvcId returns null for unknown id', () => {
      const model = createTestTree();
      expect(model.findByMvcId('unknown' as MvcId)).toBeNull();
    });

    it('findActiveTab indexes by chrome tab id', () => {
      const model = createTestTree();
      const tab = model.findActiveTab(101);
      expect(tab).not.toBeNull();
      expect(tab!.getNodeText()).toBe('A');
    });

    it('findActiveWindow indexes by chrome window id', () => {
      const model = createTestTree();
      const win = model.findActiveWindow(1);
      expect(win).not.toBeNull();
      expect(win!.type).toBe(NodeTypesEnum.WINDOW);
    });

    it('getActiveWindowNodes returns all active windows', () => {
      const model = createTestTree();
      expect(model.getActiveWindowNodes()).toHaveLength(1);
    });
  });

  describe('traversal', () => {
    it('forEach visits all nodes', () => {
      const model = createTestTree();
      const types: string[] = [];
      model.forEach((node) => types.push(node.type));
      expect(types).toContain(NodeTypesEnum.SESSION);
      expect(types).toContain(NodeTypesEnum.WINDOW);
      expect(types).toContain(NodeTypesEnum.TAB);
      expect(types).toContain(NodeTypesEnum.SAVEDWINDOW);
      expect(types).toContain(NodeTypesEnum.SAVEDTAB);
    });

    it('findNode returns matching node', () => {
      const model = createTestTree();
      const note = model.findNode((n) => n.type === NodeTypesEnum.SAVEDTAB);
      expect(note).not.toBeNull();
    });

    it('findNode returns null when no match', () => {
      const model = createTestTree();
      const note = model.findNode((n) => n.type === NodeTypesEnum.TEXTNOTE);
      expect(note).toBeNull();
    });

    it('getAllCollapsedNodes returns collapsed nodes with children', () => {
      const model = createTestTree();
      expect(model.getAllCollapsedNodes()).toHaveLength(0);

      model.root.subnodes[0].colapsed = true;
      expect(model.getAllCollapsedNodes()).toHaveLength(1);
    });
  });

  describe('insertSubnode', () => {
    it('adds node and indexes it', () => {
      const model = createTestTree();
      const newTab = new SavedTabTreeNode({ url: 'https://new.com', title: 'New' });
      model.insertSubnode(model.root, 0, newTab);

      expect(model.findByMvcId(newTab.idMVC)).toBe(newTab);
      expect(model.root.subnodes[0]).toBe(newTab);
    });

    it('returns insert mutation result', () => {
      const model = createTestTree();
      const newTab = new SavedTabTreeNode();
      const result = model.insertSubnode(model.root, 0, newTab);

      expect(result.type).toBe('insert');
      expect(result.affectedNodeId).toBe(newTab.idMVC);
      expect(result.parentUpdates).toBeDefined();
    });

    it('calls onMutation listener', () => {
      const listener = vi.fn();
      const session = new SessionTreeNode();
      const model = new TreeModel(session, { onMutation: listener });

      model.insertSubnode(model.root, 0, new SavedTabTreeNode());
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('insertAsFirstChild / insertAsLastChild', () => {
    it('insertAsFirstChild inserts at position 0', () => {
      const model = createTestTree();
      const node = new GroupTreeNode();
      model.insertAsFirstChild(model.root, node);
      expect(model.root.subnodes[0]).toBe(node);
    });

    it('insertAsLastChild appends', () => {
      const model = createTestTree();
      const node = new GroupTreeNode();
      model.insertAsLastChild(model.root, node);
      expect(model.root.subnodes[model.root.subnodes.length - 1]).toBe(node);
    });
  });

  describe('insertBefore / insertAfter', () => {
    it('insertBefore places node before ref', () => {
      const model = createTestTree();
      const ref = model.root.subnodes[1]; // savedWin
      const node = new GroupTreeNode();
      model.insertBefore(ref, node);
      expect(model.root.subnodes.indexOf(node)).toBe(1);
      expect(model.root.subnodes.indexOf(ref)).toBe(2);
    });

    it('insertAfter places node after ref', () => {
      const model = createTestTree();
      const ref = model.root.subnodes[0]; // win
      const node = new GroupTreeNode();
      model.insertAfter(ref, node);
      expect(model.root.subnodes.indexOf(node)).toBe(1);
    });
  });

  describe('removeSubtree', () => {
    it('removes node and unindexes', () => {
      const model = createTestTree();
      const win = model.root.subnodes[0];
      const winId = win.idMVC;
      const tab1Id = win.subnodes[0].idMVC;

      const result = model.removeSubtree(win);

      expect(model.findByMvcId(winId)).toBeNull();
      expect(model.findByMvcId(tab1Id)).toBeNull();
      expect(result.type).toBe('delete');
      expect(result.deletedNodeIds).toContain(winId);
      expect(result.deletedNodeIds).toContain(tab1Id);
    });

    it('suggests cursor after removal', () => {
      const model = createTestTree();
      const win = model.root.subnodes[0];
      const savedWin = model.root.subnodes[1];

      const result = model.removeSubtree(win);
      expect(result.cursorSuggestion).toBe(savedWin.idMVC);
    });

    it('suggests parent when last child removed', () => {
      const model = createTestTree();
      const savedWin = model.root.subnodes[1];
      const savedTab = savedWin.subnodes[0];

      const result = model.removeSubtree(savedTab);
      expect(result.cursorSuggestion).toBe(savedWin.idMVC);
    });

    it('unindexes chrome tab IDs', () => {
      const model = createTestTree();
      expect(model.findActiveTab(101)).not.toBeNull();

      const win = model.root.subnodes[0];
      model.removeSubtree(win);

      expect(model.findActiveTab(101)).toBeNull();
      expect(model.findActiveWindow(1)).toBeNull();
    });
  });

  describe('moveNode', () => {
    it('moves node to new parent', () => {
      const model = createTestTree();
      const savedWin = model.root.subnodes[1];
      const tab2 = model.root.subnodes[0].subnodes[1];
      const tab2Id = tab2.idMVC;

      model.moveNode(tab2, {
        containerIdMVC: savedWin.idMVC,
        position: 0,
      });

      expect(model.findByMvcId(tab2Id)).toBe(tab2);
      expect(tab2.parent).toBe(savedWin);
      expect(savedWin.subnodes[0]).toBe(tab2);
    });

    it('returns move mutation result', () => {
      const model = createTestTree();
      const tab = model.root.subnodes[0].subnodes[0];
      const result = model.moveNode(tab, {
        containerIdMVC: model.root.idMVC,
        position: 0,
      });
      expect(result.type).toBe('move');
    });
  });

  describe('setCollapsed', () => {
    it('sets collapsed state', () => {
      const model = createTestTree();
      const win = model.root.subnodes[0];
      model.setCollapsed(win, true);
      expect(win.colapsed).toBe(true);
    });

    it('prevents collapsing empty nodes', () => {
      const model = createTestTree();
      const tab = model.root.subnodes[0].subnodes[0];
      model.setCollapsed(tab, true);
      expect(tab.colapsed).toBe(false);
    });

    it('returns collapse mutation result', () => {
      const model = createTestTree();
      const result = model.setCollapsed(model.root.subnodes[0], true);
      expect(result.type).toBe('collapse');
    });
  });

  describe('setMarks', () => {
    it('updates node marks', () => {
      const model = createTestTree();
      const node = model.root.subnodes[0];
      model.setMarks(node, { relicons: [], customTitle: 'Custom' });
      expect(node.marks.customTitle).toBe('Custom');
    });

    it('returns update mutation result', () => {
      const model = createTestTree();
      const result = model.setMarks(model.root.subnodes[0], {
        relicons: [],
      });
      expect(result.type).toBe('update');
    });
  });

  describe('replaceNode', () => {
    it('replaces node preserving children', () => {
      const model = createTestTree();
      const win = model.root.subnodes[0];
      const childCount = win.subnodes.length;
      const oldId = win.idMVC;

      const savedWinReplacement = new SavedWindowTreeNode({ id: 99 });
      const result = model.replaceNode(win, savedWinReplacement);

      expect(model.findByMvcId(oldId)).toBeNull();
      expect(model.findByMvcId(savedWinReplacement.idMVC)).toBe(
        savedWinReplacement,
      );
      expect(savedWinReplacement.subnodes).toHaveLength(childCount);
      expect(savedWinReplacement.previousIdMVC).toBe(oldId);
      expect(result.type).toBe('replace');
    });
  });

  describe('serialization', () => {
    it('toHierarchyJSO produces valid structure', () => {
      const model = createTestTree();
      const jso = model.toHierarchyJSO();

      expect(jso.n).toBeDefined();
      expect(jso.n.type).toBe('session');
      expect(jso.s).toHaveLength(2);
    });
  });

  describe('static factories', () => {
    it('fromHierarchyJSO creates a TreeModel', () => {
      const jso: HierarchyJSO = {
        n: {
          type: 'session',
          data: { treeId: 't', nextDId: 1, nonDumpedDId: 1 },
        },
        s: [
          {
            n: { type: 'savedwin', data: { id: 1 } },
            s: [
              { n: { data: { url: 'https://a.com', title: 'A' } } },
            ],
          },
        ],
      };

      const model = TreeModel.fromHierarchyJSO(jso);
      expect(model.root.type).toBe(NodeTypesEnum.SESSION);
      expect(model.root.subnodes).toHaveLength(1);
      expect(model.root.subnodes[0].subnodes).toHaveLength(1);
    });

    it('createEmpty creates a model with session root', () => {
      const model = TreeModel.createEmpty();
      expect(model.root.type).toBe(NodeTypesEnum.SESSION);
      expect(model.root.subnodes).toHaveLength(0);
    });

    it('createEmpty passes options through', () => {
      const listener = vi.fn();
      const model = TreeModel.createEmpty({ onMutation: listener });
      model.insertSubnode(model.root, 0, new SavedTabTreeNode());
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('mutation listener', () => {
    it('receives all mutation types', () => {
      const results: TreeMutationResult[] = [];
      const model = new TreeModel(new SessionTreeNode(), {
        onMutation: (r) => results.push(r),
      });

      const group = new GroupTreeNode();
      model.insertSubnode(model.root, 0, group);
      model.setCollapsed(group, true);
      model.setMarks(group, { relicons: [], customTitle: 'X' });

      const tab = new SavedTabTreeNode();
      model.insertSubnode(group, 0, tab);
      model.removeSubtree(tab);

      expect(results.map((r) => r.type)).toEqual([
        'insert',
        'collapse',
        'update',
        'insert',
        'delete',
      ]);
    });
  });
});
