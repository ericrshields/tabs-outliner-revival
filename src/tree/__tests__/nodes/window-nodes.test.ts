import { describe, it, expect, beforeEach } from 'vitest';
import { WindowTreeNode } from '../../nodes/window-node';
import { SavedWindowTreeNode } from '../../nodes/saved-window-node';
import { WaitingWindowTreeNode } from '../../nodes/waiting-window-node';
import { SavedTabTreeNode } from '../../nodes/saved-tab-node';
import { TabTreeNode } from '../../nodes/tab-node';
import { NodeTypesEnum } from '../../../types/enums';
import type { WindowData } from '../../../types/node-data';
import { resetMvcIdCounter } from '../../mvc-id';

const sampleWindowData: WindowData = {
  id: 7,
  type: 'normal',
  focused: true,
  incognito: false,
};

describe('SavedWindowTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new SavedWindowTreeNode(sampleWindowData);
    expect(node.type).toBe(NodeTypesEnum.SAVEDWINDOW);
    expect(node.titleCssClass).toBe('savedwin');
    expect(node.titleBackgroundCssClass).toBe('windowFrame');
    expect(node.isLink).toBe(false);
    expect(node.needFaviconAndTextHelperContainer).toBe(true);
  });

  it('returns default display values', () => {
    const node = new SavedWindowTreeNode(sampleWindowData);
    expect(node.getNodeText()).toBe('Window');
    expect(node.getIcon()).toBe('img/chrome-window-icon-gray.png');
    expect(node.getHref()).toBeNull();
    expect(node.getTooltipText()).toBe('');
  });

  it('displays close date in title', () => {
    const closeDate = new Date('2024-01-15T12:00:00Z').getTime();
    const node = new SavedWindowTreeNode({
      ...sampleWindowData,
      closeDate,
    });
    const text = node.getNodeText();
    expect(text).toContain('closed');
    expect(text).toContain('2024');
    expect(text).toContain('Jan');
  });

  it('displays crash date in title', () => {
    const node = new SavedWindowTreeNode({
      ...sampleWindowData,
      crashDetectedDate: new Date('2024-02-20').getTime(),
    });
    expect(node.getNodeText()).toContain('crashed');
  });

  it('uses custom marks for icon and text', () => {
    const node = new SavedWindowTreeNode(sampleWindowData);
    node.marks = {
      relicons: [],
      customFavicon: 'img/custom.png',
      customTitle: 'My Window',
    };
    expect(node.getIcon()).toBe('img/custom.png');
    // getNodeText uses marks.customTitle for base text
    expect(node.getNodeText()).toBe('My Window');
  });

  it('serializes window data correctly', () => {
    const node = new SavedWindowTreeNode(sampleWindowData);
    const data = node.serializeData();
    // focused false should be stripped (it's truthy here, so kept)
    expect(data.focused).toBe(true);
    expect(data.id).toBe(7);
  });

  it('has editTitle in hovering menu', () => {
    const node = new SavedWindowTreeNode(sampleWindowData);
    const actions = node.getHoveringMenuActions();
    expect(actions.editTitleAction).toBeDefined();
    expect(actions.deleteAction).toBeDefined();
  });

  it('cloneAsSaved returns SavedWindowTreeNode', () => {
    const node = new SavedWindowTreeNode(sampleWindowData);
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SavedWindowTreeNode);
  });
});

describe('WindowTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new WindowTreeNode(sampleWindowData);
    expect(node.type).toBe(NodeTypesEnum.WINDOW);
    expect(node.titleCssClass).toBe('win');
    expect(node.titleBackgroundCssClass).toBe('windowFrame');
  });

  it('isAnOpenWindow returns true', () => {
    expect(new WindowTreeNode(sampleWindowData).isAnOpenWindow()).toBe(true);
  });

  it('isFocusedWindow reflects data', () => {
    const focused = new WindowTreeNode({ ...sampleWindowData, focused: true });
    expect(focused.isFocusedWindow()).toBe(true);

    const unfocused = new WindowTreeNode({
      ...sampleWindowData,
      focused: false,
    });
    expect(unfocused.isFocusedWindow()).toBe(false);
  });

  it('shows window type in title for non-normal', () => {
    const popup = new WindowTreeNode({ ...sampleWindowData, type: 'popup' });
    expect(popup.getNodeText()).toBe('Window (popup)');
  });

  it('shows plain "Window" for normal type', () => {
    const normal = new WindowTreeNode(sampleWindowData);
    expect(normal.getNodeText()).toBe('Window');
  });

  it('uses blue icon for active window', () => {
    const node = new WindowTreeNode(sampleWindowData);
    expect(node.getIcon()).toBe('img/chrome-window-icon-blue.png');
  });

  it('updateChromeData replaces data', () => {
    const node = new WindowTreeNode(sampleWindowData);
    node.updateChromeData({ ...sampleWindowData, focused: false });
    expect(node.isFocusedWindow()).toBe(false);
  });

  it('cloneAsSaved returns SavedWindowTreeNode', () => {
    const node = new WindowTreeNode(sampleWindowData);
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SavedWindowTreeNode);
  });

  it('has close action in hovering menu', () => {
    const node = new WindowTreeNode(sampleWindowData);
    const actions = node.getHoveringMenuActions();
    expect(actions.closeAction).toBeDefined();
  });

  it('counts as active window in stats', () => {
    const parent = new SavedWindowTreeNode();
    const win = new WindowTreeNode(sampleWindowData);
    parent.insertSubnode(0, win);
    const stats = parent.countSubnodesStats();
    expect(stats.activeWinsCount).toBe(1);
  });

  it('calculateIsProtectedFromGoneOnClose detects non-tab subnodes', () => {
    const win = new WindowTreeNode(sampleWindowData);
    expect(win.calculateIsProtectedFromGoneOnClose()).toBe(false);

    // Add a saved tab subnode (not just active tab = something worth preserving)
    win.insertSubnode(0, new SavedTabTreeNode({ url: 'test' }));
    expect(win.calculateIsProtectedFromGoneOnClose()).toBe(true);
  });
});

describe('WaitingWindowTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type', () => {
    const node = new WaitingWindowTreeNode();
    expect(node.type).toBe(NodeTypesEnum.WAITINGWINDOW);
    expect(node.titleCssClass).toBe('waitingwin');
  });

  it('shows waiting text', () => {
    const node = new WaitingWindowTreeNode();
    expect(node.getNodeText()).toBe('Window waiting for a creation');
  });

  it('cloneAsSaved returns SavedWindowTreeNode', () => {
    const node = new WaitingWindowTreeNode();
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SavedWindowTreeNode);
  });
});
