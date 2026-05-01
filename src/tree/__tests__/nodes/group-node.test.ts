import { describe, it, expect, beforeEach } from 'vitest';
import { GroupTreeNode } from '../../nodes/group-node';
import { TabTreeNode } from '../../nodes/tab-node';
import { SavedTabTreeNode } from '../../nodes/saved-tab-node';
import { NodeTypesEnum } from '@/types/enums';
import type { TabData } from '@/types/node-data';
import { resetMvcIdCounter } from '../../mvc-id';

const sampleActiveTabData: TabData = {
  id: 99,
  windowId: 1,
  url: 'https://example.com',
  title: 'Example',
  status: 'complete',
  pinned: false,
  active: true,
};

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

  it('counts as saved group when it has no descendants', () => {
    const parent = new GroupTreeNode();
    const empty = new GroupTreeNode();
    parent.insertSubnode(0, empty);
    const stats = parent.countSubnodesStats();
    expect(stats.savedGroupsCount).toBe(1);
    expect(stats.activeGroupsCount).toBe(0);
  });

  it('counts as saved group when it contains only saved tabs', () => {
    const parent = new GroupTreeNode();
    const group = new GroupTreeNode();
    group.insertSubnode(0, new SavedTabTreeNode());
    group.insertSubnode(1, new SavedTabTreeNode());
    parent.insertSubnode(0, group);
    const stats = parent.countSubnodesStats();
    expect(stats.savedGroupsCount).toBe(1);
    expect(stats.activeGroupsCount).toBe(0);
  });

  it('counts as active group when at least one descendant is an active tab', () => {
    const parent = new GroupTreeNode();
    const group = new GroupTreeNode();
    group.insertSubnode(0, new SavedTabTreeNode());
    group.insertSubnode(1, new TabTreeNode(sampleActiveTabData));
    parent.insertSubnode(0, group);
    const stats = parent.countSubnodesStats();
    expect(stats.activeGroupsCount).toBe(1);
    expect(stats.savedGroupsCount).toBe(0);
  });

  it('reverts to saved group when its only active tab is removed', () => {
    // Models the user-reported bug: a group should stop counting as
    // an active container once its last active descendant goes away.
    const parent = new GroupTreeNode();
    const group = new GroupTreeNode();
    const activeTab = new TabTreeNode(sampleActiveTabData);
    group.insertSubnode(0, activeTab);
    parent.insertSubnode(0, group);

    expect(parent.countSubnodesStats().activeGroupsCount).toBe(1);

    activeTab.removeFromParent();
    const stats = parent.countSubnodesStats();
    expect(stats.activeGroupsCount).toBe(0);
    expect(stats.savedGroupsCount).toBe(1);
  });

  it('counts the outermost active ancestor when active groups are nested', () => {
    // Mirrors Chrome's behavior: one Chrome window covers the whole
    // nested chain, so a group nested inside another active group
    // doesn't add to the active-container count.
    const parent = new GroupTreeNode();
    const outer = new GroupTreeNode();
    const inner = new GroupTreeNode();
    inner.insertSubnode(0, new TabTreeNode(sampleActiveTabData));
    outer.insertSubnode(0, inner);
    parent.insertSubnode(0, outer);
    const stats = parent.countSubnodesStats();
    expect(stats.activeGroupsCount).toBe(1);
    expect(stats.savedGroupsCount).toBe(1);
  });

  it('sibling active groups each count as their own active container', () => {
    // Two unrelated branches → two Chrome windows.
    const parent = new GroupTreeNode();
    const left = new GroupTreeNode();
    const right = new GroupTreeNode();
    left.insertSubnode(0, new TabTreeNode(sampleActiveTabData));
    right.insertSubnode(0, new TabTreeNode(sampleActiveTabData));
    parent.insertSubnode(0, left);
    parent.insertSubnode(1, right);
    const stats = parent.countSubnodesStats();
    expect(stats.activeGroupsCount).toBe(2);
    expect(stats.savedGroupsCount).toBe(0);
  });
});
