import { describe, it, expect, beforeEach } from 'vitest';
import { GroupTreeNode } from '../../nodes/group-node';
import { NodeTypesEnum } from '@/types/enums';
import { resetMvcIdCounter } from '../../mvc-id';

describe('GroupTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new GroupTreeNode();
    expect(node.type).toBe(NodeTypesEnum.GROUP);
    expect(node.titleCssClass).toBe('group');
    expect(node.titleBackgroundCssClass).toBe('windowFrame');
    expect(node.isLink).toBe(false);
    expect(node.needFaviconAndTextHelperContainer).toBe(true);
  });

  it('data is null', () => {
    expect(new GroupTreeNode().data).toBeNull();
  });

  it('returns default display values', () => {
    const node = new GroupTreeNode();
    expect(node.getNodeText()).toBe('Group');
    expect(node.getIcon()).toBe('img/group-icon.png');
    expect(node.getHref()).toBeNull();
    expect(node.getTooltipText()).toBe('');
    expect(node.getCustomTitle()).toBeNull();
  });

  it('uses custom marks for icon and text', () => {
    const node = new GroupTreeNode();
    node.marks = {
      relicons: [],
      customFavicon: 'img/custom.png',
      customTitle: 'My Group',
    };
    expect(node.getIcon()).toBe('img/custom.png');
    expect(node.getNodeText()).toBe('My Group');
  });

  it('serializes data as null', () => {
    expect(new GroupTreeNode().serializeData()).toBeNull();
  });

  it('cloneAsSaved returns GroupTreeNode with marks', () => {
    const node = new GroupTreeNode();
    node.marks = { relicons: [], customTitle: 'Test' };
    node.colapsed = true;
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(GroupTreeNode);
    expect(clone.marks.customTitle).toBe('Test');
    expect(clone.colapsed).toBe(true);
  });

  it('has editTitle in hovering menu', () => {
    const node = new GroupTreeNode();
    const actions = node.getHoveringMenuActions();
    expect(actions.editTitleAction).toBeDefined();
    expect(actions.deleteAction).toBeDefined();
  });
});
