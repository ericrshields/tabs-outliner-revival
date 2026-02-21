import { describe, it, expect, beforeEach } from 'vitest';
import { TextNoteTreeNode } from '../../nodes/text-note-node';
import { SeparatorTreeNode } from '../../nodes/separator-node';
import { NodeTypesEnum } from '@/types/enums';
import { resetMvcIdCounter } from '../../mvc-id';

describe('TextNoteTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new TextNoteTreeNode();
    expect(node.type).toBe(NodeTypesEnum.TEXTNOTE);
    expect(node.titleCssClass).toBe('textnote');
    expect(node.titleBackgroundCssClass).toBe('defaultFrame');
    expect(node.isLink).toBe(false);
    expect(node.needFaviconAndTextHelperContainer).toBe(false);
  });

  it('defaults note to "#"', () => {
    const node = new TextNoteTreeNode();
    expect(node.getNodeText()).toBe('#');
    expect(node.data.note).toBe('#');
  });

  it('accepts custom note text', () => {
    const node = new TextNoteTreeNode({ note: 'Hello world' });
    expect(node.getNodeText()).toBe('Hello world');
  });

  it('returns null for icon/href/customTitle', () => {
    const node = new TextNoteTreeNode();
    expect(node.getIcon()).toBeNull();
    expect(node.getIconForHtmlExport()).toBeNull();
    expect(node.getHref()).toBeNull();
    expect(node.getCustomTitle()).toBeNull();
    expect(node.getNodeContentCssClass()).toBeNull();
  });

  it('serializes data correctly', () => {
    const node = new TextNoteTreeNode({ note: 'Test' });
    expect(node.serializeData()).toEqual({ note: 'Test' });
  });

  it('cloneAsSaved preserves text and marks', () => {
    const node = new TextNoteTreeNode({ note: 'Clone me' });
    node.marks = { relicons: [], customColorSaved: '#ff0000' };
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(TextNoteTreeNode);
    expect(clone.getNodeText()).toBe('Clone me');
    expect(clone.marks.customColorSaved).toBe('#ff0000');
  });

  it('has editTitle in hovering menu', () => {
    const node = new TextNoteTreeNode();
    const actions = node.getHoveringMenuActions();
    expect(actions.editTitleAction).toBeDefined();
    expect(actions.deleteAction).toBeDefined();
    expect(actions.setCursorAction).toBeDefined();
  });
});

describe('SeparatorTreeNode', () => {
  beforeEach(() => resetMvcIdCounter());

  it('has correct type and styling', () => {
    const node = new SeparatorTreeNode();
    expect(node.type).toBe(NodeTypesEnum.SEPARATORLINE);
    expect(node.titleCssClass).toBe('separatorline');
    expect(node.titleBackgroundCssClass).toBe('defaultFrame');
    expect(node.isLink).toBe(false);
  });

  it('defaults to separator style 0', () => {
    const node = new SeparatorTreeNode();
    expect(node.data.separatorIndx).toBe(0);
    expect(node.getNodeText()).toContain('---');
    expect(node.getNodeContentCssClass()).toBe('b');
  });

  it('supports separator style 1', () => {
    const node = new SeparatorTreeNode({ separatorIndx: 1 });
    expect(node.getNodeText()).toContain('===');
    expect(node.getNodeContentCssClass()).toBe('a');
  });

  it('supports separator style 2', () => {
    const node = new SeparatorTreeNode({ separatorIndx: 2 });
    expect(node.getNodeText()).toContain('- -');
    expect(node.getNodeContentCssClass()).toBe('c');
  });

  it('serializes data correctly', () => {
    const node = new SeparatorTreeNode({ separatorIndx: 1 });
    expect(node.serializeData()).toEqual({ separatorIndx: 1 });
  });

  it('cloneAsSaved preserves style', () => {
    const node = new SeparatorTreeNode({ separatorIndx: 2 });
    const clone = node.cloneAsSaved();
    expect(clone).toBeInstanceOf(SeparatorTreeNode);
    expect((clone as SeparatorTreeNode).data.separatorIndx).toBe(2);
  });

  it('returns null for icon/href', () => {
    const node = new SeparatorTreeNode();
    expect(node.getIcon()).toBeNull();
    expect(node.getHref()).toBeNull();
  });
});
