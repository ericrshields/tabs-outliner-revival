import { describe, it, expect, beforeEach } from 'vitest';
import { SessionTreeNode } from '../../nodes/session-node';
import { GroupTreeNode } from '../../nodes/group-node';
import { NodeTypesEnum } from '@/types/enums';
import { resetMvcIdCounter } from '../../mvc-id';

describe('SessionTreeNode', () => {
  beforeEach(() => {
    resetMvcIdCounter();
  });

  it('has correct type and styling', () => {
    const node = new SessionTreeNode();
    expect(node.type).toBe(NodeTypesEnum.SESSION);
    expect(node.titleCssClass).toBe('session');
    expect(node.titleBackgroundCssClass).toBe('windowFrame');
    expect(node.isLink).toBe(false);
    expect(node.needFaviconAndTextHelperContainer).toBe(true);
  });

  it('generates default persistent data when none provided', () => {
    const node = new SessionTreeNode();
    expect(node.data.treeId).toBeTruthy();
    expect(node.data.nextDId).toBe(1);
    expect(node.data.nonDumpedDId).toBe(1);
  });

  it('accepts partial persistent data', () => {
    const node = new SessionTreeNode({ treeId: 'test-tree', nextDId: 42, nonDumpedDId: 10 });
    expect(node.treeId).toBe('test-tree');
    expect(node.nextDId).toBe(42);
  });

  it('allocateDId increments counter', () => {
    const node = new SessionTreeNode({ treeId: 't', nextDId: 5, nonDumpedDId: 1 });
    expect(node.allocateDId()).toBe(5);
    expect(node.allocateDId()).toBe(6);
    expect(node.nextDId).toBe(7);
  });

  it('peekNextDId does not advance', () => {
    const node = new SessionTreeNode({ treeId: 't', nextDId: 10, nonDumpedDId: 1 });
    expect(node.peekNextDId()).toBe(10);
    expect(node.peekNextDId()).toBe(10);
  });

  it('advanceNextDIdTo only advances forward', () => {
    const node = new SessionTreeNode({ treeId: 't', nextDId: 10, nonDumpedDId: 1 });
    node.advanceNextDIdTo(5); // no change
    expect(node.nextDId).toBe(10);
    node.advanceNextDIdTo(20);
    expect(node.nextDId).toBe(20);
  });

  it('returns correct display text', () => {
    const node = new SessionTreeNode();
    expect(node.getNodeText()).toBe('Current Session');
    expect(node.getIcon()).toBe('img/favicon.png');
    expect(node.getTooltipText()).toBe('');
    expect(node.getHref()).toBeNull();
    expect(node.getCustomTitle()).toBeNull();
  });

  it('only has setCursor in hovering menu (no delete)', () => {
    const node = new SessionTreeNode();
    const actions = node.getHoveringMenuActions();
    expect(actions.setCursorAction).toBeDefined();
    expect(actions.deleteAction).toBeUndefined();
  });

  it('cloneAsSaved returns a GroupTreeNode', () => {
    const node = new SessionTreeNode();
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(GroupTreeNode);
    expect(clone.marks.customTitle).toBe('Tree');
  });

  it('serializes data correctly', () => {
    const node = new SessionTreeNode({ treeId: 'test', nextDId: 5, nonDumpedDId: 3 });
    const data = node.serializeData();
    expect(data).toEqual({ treeId: 'test', nextDId: 5, nonDumpedDId: 3 });
  });
});
