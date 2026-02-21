import { describe, it, expect, beforeEach } from 'vitest';
import { toNodeDTO, computeParentUpdate, computeParentUpdatesToRoot } from '../dto';
import { SessionTreeNode } from '../nodes/session-node';
import { TabTreeNode } from '../nodes/tab-node';
import { SavedTabTreeNode } from '../nodes/saved-tab-node';
import { WindowTreeNode } from '../nodes/window-node';
import { SavedWindowTreeNode } from '../nodes/saved-window-node';
import { GroupTreeNode } from '../nodes/group-node';
import { TextNoteTreeNode } from '../nodes/text-note-node';
import { SeparatorTreeNode } from '../nodes/separator-node';
import { resetMvcIdCounter } from '../mvc-id';

describe('toNodeDTO', () => {
  beforeEach(() => resetMvcIdCounter());

  it('creates DTO with correct identity fields', () => {
    const node = new SavedTabTreeNode({ url: 'https://example.com', title: 'Ex' });
    const dto = toNodeDTO(node);

    expect(dto.id).toBe(node.idMVC);
    expect(dto.idMVC).toBe(node.idMVC);
    expect(dto.previousIdMVC).toBeUndefined();
  });

  it('snapshots tab node computed fields', () => {
    const tab = new TabTreeNode({
      url: 'https://example.com',
      title: 'Test',
      active: true,
      favIconUrl: 'https://example.com/icon.png',
    });
    const dto = toNodeDTO(tab);

    expect(dto._getNodeText).toBe('Test');
    expect(dto._getHref).toBe('https://example.com');
    expect(dto._getIcon).toBe('https://example.com/icon.png');
    expect(dto._isSelectedTab).toBe(true);
    expect(dto._isFocusedWindow).toBe(false);
    expect(dto.isLink).toBe(true);
    expect(dto.titleCssClass).toBe('tab');
    expect(dto.titleBackgroundCssClass).toBe('tabFrame');
  });

  it('snapshots window node computed fields', () => {
    const win = new WindowTreeNode({ id: 1, type: 'normal', focused: true });
    const dto = toNodeDTO(win);

    expect(dto._getNodeText).toBe('Window');
    expect(dto._isFocusedWindow).toBe(true);
    expect(dto._getIcon).toBe('img/chrome-window-icon-blue.png');
    expect(dto.needFaviconAndTextHelperContainer).toBe(true);
  });

  it('recursively builds DTOs for expanded children', () => {
    const win = new SavedWindowTreeNode({ id: 1 });
    const tab1 = new SavedTabTreeNode({ url: 'a', title: 'A' });
    const tab2 = new SavedTabTreeNode({ url: 'b', title: 'B' });
    win.insertSubnode(0, tab1);
    win.insertSubnode(1, tab2);

    const dto = toNodeDTO(win);
    expect(dto.subnodes).toHaveLength(2);
    expect(dto.subnodes[0]._getNodeText).toBe('A');
    expect(dto.subnodes[1]._getNodeText).toBe('B');
    expect(dto._isSubnodesPresent).toBe(true);
    expect(dto._countSubnodesStatsBlockData).toBeNull(); // not collapsed
  });

  it('returns empty subnodes and stats when collapsed', () => {
    const win = new SavedWindowTreeNode({ id: 1 });
    const tab = new TabTreeNode({ id: 42, url: 'a', title: 'A', active: true });
    win.insertSubnode(0, tab);
    win.colapsed = true;

    const dto = toNodeDTO(win);
    expect(dto.subnodes).toHaveLength(0);
    expect(dto._countSubnodesStatsBlockData).not.toBeNull();
    expect(dto._countSubnodesStatsBlockData!.activeTabsCount).toBe(1);
    expect(dto._countSubnodesStatsBlockData!.nodesCount).toBe(1);
  });

  it('snapshots session node', () => {
    const session = new SessionTreeNode();
    const dto = toNodeDTO(session);

    expect(dto._getNodeText).toBe('Current Session');
    expect(dto._getIcon).toBe('img/favicon.png');
    expect(dto._hoveringMenuActions.setCursorAction).toBeDefined();
    expect(dto._hoveringMenuActions.deleteAction).toBeUndefined();
  });

  it('snapshots group node', () => {
    const group = new GroupTreeNode();
    group.marks = { relicons: [], customTitle: 'My Group' };
    const dto = toNodeDTO(group);

    expect(dto._getNodeText).toBe('My Group');
    expect(dto.titleBackgroundCssClass).toBe('windowFrame');
  });

  it('snapshots text note node', () => {
    const note = new TextNoteTreeNode({ note: 'Hello world' });
    const dto = toNodeDTO(note);

    expect(dto._getNodeText).toBe('Hello world');
    expect(dto._getIcon).toBe('');
    expect(dto.titleBackgroundCssClass).toBe('defaultFrame');
  });

  it('snapshots separator node', () => {
    const sep = new SeparatorTreeNode({ separatorIndx: 1 });
    const dto = toNodeDTO(sep);

    expect(dto._getNodeText).toContain('===');
    expect(dto._getNodeContentCssClass).toBe('a');
  });

  it('captures previousIdMVC when set', () => {
    const node = new SavedTabTreeNode({ url: 'test' });
    node.previousIdMVC = 'idmvc99' as any;
    const dto = toNodeDTO(node);
    expect(dto.previousIdMVC).toBe('idmvc99');
  });

  it('includes hovering menu actions', () => {
    const tab = new TabTreeNode({ url: 'test', title: 'T' });
    const dto = toNodeDTO(tab);

    expect(dto._hoveringMenuActions.deleteAction).toBeDefined();
    expect(dto._hoveringMenuActions.closeAction).toBeDefined();
    expect(dto._hoveringMenuActions.editTitleAction).toBeDefined();
    expect(dto._hoveringMenuActions.setCursorAction).toBeDefined();
  });

  it('snapshots custom text style', () => {
    const tab = new SavedTabTreeNode({ url: 'test' });
    tab.marks = { relicons: [], customColorSaved: '#ff0000' };
    const dto = toNodeDTO(tab);
    expect(dto._getNodeTextCustomStyle).toBe('color:#ff0000');
  });
});

describe('computeParentUpdate', () => {
  beforeEach(() => resetMvcIdCounter());

  it('computes update for node with children', () => {
    const win = new SavedWindowTreeNode({ id: 1 });
    const tab = new SavedTabTreeNode({ url: 'test' });
    win.insertSubnode(0, tab);

    const update = computeParentUpdate(win);
    expect(update.isSubnodesPresent).toBe(true);
    expect(update.isCollapsed).toBe(false);
    expect(update.subnodesStatBlock).toBeNull(); // not collapsed
    expect(update.titleCssClass).toBe('savedwin');
    expect(update.titleBackgroundCssClass).toBe('windowFrame');
  });

  it('includes stats when collapsed', () => {
    const win = new SavedWindowTreeNode({ id: 1 });
    const tab = new TabTreeNode({ id: 42, url: 'test', active: true });
    win.insertSubnode(0, tab);
    win.colapsed = true;

    const update = computeParentUpdate(win);
    expect(update.isCollapsed).toBe(true);
    expect(update.subnodesStatBlock).not.toBeNull();
    expect(update.subnodesStatBlock!.activeTabsCount).toBe(1);
  });
});

describe('computeParentUpdatesToRoot', () => {
  beforeEach(() => resetMvcIdCounter());

  it('builds updates from node to root', () => {
    const session = new SessionTreeNode();
    const win = new SavedWindowTreeNode();
    const tab = new SavedTabTreeNode({ url: 'test' });
    session.insertSubnode(0, win);
    win.insertSubnode(0, tab);

    const updates = computeParentUpdatesToRoot(tab);

    expect(Object.keys(updates)).toHaveLength(3); // tab, win, session
    expect(updates[tab.idMVC]).toBeDefined();
    expect(updates[win.idMVC]).toBeDefined();
    expect(updates[session.idMVC]).toBeDefined();
  });
});
