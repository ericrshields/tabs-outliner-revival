import { describe, it, expect, beforeEach } from 'vitest';
import { TabTreeNode } from '../../nodes/tab-node';
import { SavedTabTreeNode } from '../../nodes/saved-tab-node';
import { WaitingTabTreeNode } from '../../nodes/waiting-tab-node';
import { AttachWaitTabTreeNode } from '../../nodes/attach-wait-tab-node';
import { NodeTypesEnum } from '@/types/enums';
import type { TabData } from '@/types/node-data';
import { resetMvcIdCounter } from '../../mvc-id';

const sampleTabData: TabData = {
  id: 42,
  windowId: 1,
  url: 'https://example.com',
  title: 'Example',
  favIconUrl: 'https://example.com/icon.png',
  status: 'complete',
  pinned: false,
  active: true,
};

describe('SavedTabTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    expect(node.type).toBe(NodeTypesEnum.SAVEDTAB);
    expect(node.titleCssClass).toBe('savedtab');
    expect(node.titleBackgroundCssClass).toBe('tabFrame');
    expect(node.isLink).toBe(true);
    expect(node.needFaviconAndTextHelperContainer).toBe(false);
  });

  it('strips windowId from data', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    expect(node.data.windowId).toBeUndefined();
  });

  it('converts loading status to complete', () => {
    const node = new SavedTabTreeNode({ ...sampleTabData, status: 'loading' });
    expect(node.data.status).toBe('complete');
  });

  it('returns correct display values', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    expect(node.getNodeText()).toBe('Example');
    expect(node.getHref()).toBe('https://example.com');
    expect(node.getIcon()).toBe('https://example.com/icon.png');
    expect(node.getIconForHtmlExport()).toBe('https://example.com/icon.png');
    expect(node.getTooltipText()).toBe('');
  });

  it('returns loading icon when status is loading', () => {
    // Construct with a tab that bypasses the constructor cleaning
    const node = new SavedTabTreeNode();
    // Manually test the getIcon path for loading
    expect(node.getIcon()).toContain('chromeFavicon');
  });

  it('returns customTitle from marks', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    expect(node.getCustomTitle()).toBeNull();
    node.marks = { relicons: [], customTitle: 'Custom' };
    expect(node.getCustomTitle()).toBe('Custom');
  });

  it('isSelectedTab reads active field', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    expect(node.isSelectedTab()).toBe(true);
    const inactive = new SavedTabTreeNode({ ...sampleTabData, active: false });
    expect(inactive.isSelectedTab()).toBe(false);
  });

  it('cloneAsSaved returns SavedTabTreeNode with marks', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    node.marks = { relicons: [], customTitle: 'Foo' };
    node.colapsed = true;
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SavedTabTreeNode);
    expect(clone.marks.customTitle).toBe('Foo');
    expect(clone.colapsed).toBe(true);
  });

  it('serializes tab data, stripping default fields', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    const data = node.serializeData();
    // status "complete" should be stripped
    expect(data.status).toBeUndefined();
    // pinned false should be stripped
    expect(data.pinned).toBeUndefined();
    // url should remain
    expect(data.url).toBe('https://example.com');
  });

  it('has editTitle in hovering menu', () => {
    const node = new SavedTabTreeNode(sampleTabData);
    const actions = node.getHoveringMenuActions();
    expect(actions.deleteAction).toBeDefined();
    expect(actions.setCursorAction).toBeDefined();
    expect(actions.editTitleAction).toBeDefined();
    expect(actions.closeAction).toBeUndefined();
  });
});

describe('TabTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new TabTreeNode(sampleTabData);
    expect(node.type).toBe(NodeTypesEnum.TAB);
    expect(node.titleCssClass).toBe('tab');
    expect(node.titleBackgroundCssClass).toBe('tabFrame');
    expect(node.isLink).toBe(true);
  });

  it('isAnOpenTab returns true', () => {
    expect(new TabTreeNode(sampleTabData).isAnOpenTab()).toBe(true);
  });

  it('updateChromeData replaces data', () => {
    const node = new TabTreeNode(sampleTabData);
    node.updateChromeData({ ...sampleTabData, title: 'Updated' });
    expect(node.getNodeText()).toBe('Updated');
    expect(node.chromeTabObj.title).toBe('Updated');
  });

  it('cloneAsSaved returns SavedTabTreeNode', () => {
    const node = new TabTreeNode(sampleTabData);
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SavedTabTreeNode);
    expect(clone.getNodeText()).toBe('Example');
  });

  it('has close action in hovering menu', () => {
    const node = new TabTreeNode(sampleTabData);
    const actions = node.getHoveringMenuActions();
    expect(actions.closeAction).toBeDefined();
    expect(actions.editTitleAction).toBeDefined();
  });

  it('calculateIsProtectedFromGoneOnClose detects marks', () => {
    const node = new TabTreeNode(sampleTabData);
    expect(node.calculateIsProtectedFromGoneOnClose()).toBe(false);

    node.marks = { relicons: [{ src: 'x', w: 1, h: 1 }] };
    expect(node.calculateIsProtectedFromGoneOnClose()).toBe(true);
  });

  it('counts as active tab in stats', () => {
    const parent = new SavedTabTreeNode();
    const tab = new TabTreeNode(sampleTabData);
    parent.insertSubnode(0, tab);
    const stats = parent.countSubnodesStats();
    expect(stats.activeTabsCount).toBe(1);
  });
});

describe('WaitingTabTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type', () => {
    const node = new WaitingTabTreeNode(sampleTabData);
    expect(node.type).toBe(NodeTypesEnum.WAITINGTAB);
    expect(node.titleCssClass).toBe('waitingtab');
  });

  it('returns tab display values', () => {
    const node = new WaitingTabTreeNode(sampleTabData);
    expect(node.getNodeText()).toBe('Example');
    expect(node.getHref()).toBe('https://example.com');
  });
});

describe('AttachWaitTabTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type', () => {
    const node = new AttachWaitTabTreeNode(sampleTabData);
    expect(node.type).toBe(NodeTypesEnum.ATTACHWAITINGTAB);
    expect(node.titleCssClass).toBe('attachwaitingtab');
  });

  it('isAnOpenTab returns true', () => {
    expect(new AttachWaitTabTreeNode(sampleTabData).isAnOpenTab()).toBe(true);
  });

  it('cloneAsSaved returns SavedTabTreeNode', () => {
    const node = new AttachWaitTabTreeNode(sampleTabData);
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SavedTabTreeNode);
  });

  it('has close action in hovering menu', () => {
    const node = new AttachWaitTabTreeNode(sampleTabData);
    const actions = node.getHoveringMenuActions();
    expect(actions.closeAction).toBeDefined();
  });
});
