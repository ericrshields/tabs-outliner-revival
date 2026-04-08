import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { HoveringMenu } from './HoveringMenu';
import type { HoveringMenuProps } from './HoveringMenu';

function makeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 100,
    right: 400,
    bottom: 124,
    left: 0,
    width: 400,
    height: 24,
    x: 0,
    y: 100,
    toJSON: () => {},
    ...overrides,
  };
}

function renderMenu(overrides: Partial<HoveringMenuProps> = {}) {
  const onAction = overrides.onAction ?? vi.fn();
  const props: HoveringMenuProps = {
    idMVC: 'node1',
    actions: {
      closeAction: { id: 'closeAction' },
      deleteAction: { id: 'deleteAction' },
    },
    anchorRect: makeRect(),
    onAction,
    ...overrides,
  };
  return { ...render(<HoveringMenu {...props} />), onAction };
}

describe('HoveringMenu', () => {
  it('renders close button when closeAction present', () => {
    const { getByTitle } = renderMenu();
    expect(getByTitle('Close')).toBeTruthy();
  });

  it('renders delete button when deleteAction present', () => {
    const { getByTitle } = renderMenu();
    expect(getByTitle('Delete')).toBeTruthy();
  });

  it('returns null when no actions available', () => {
    const { container } = renderMenu({ actions: {} });
    expect(container.querySelector('.hovering-menu')).toBeNull();
  });

  it('calls onAction with closeAction on close click', () => {
    const onAction = vi.fn();
    const { getByTitle } = renderMenu({ onAction });
    fireEvent.click(getByTitle('Close'));
    expect(onAction).toHaveBeenCalledWith('node1', 'closeAction');
  });

  it('calls onAction with deleteAction on delete click', () => {
    const onAction = vi.fn();
    const { getByTitle } = renderMenu({ onAction });
    fireEvent.click(getByTitle('Delete'));
    expect(onAction).toHaveBeenCalledWith('node1', 'deleteAction');
  });

  it('positions right edge at anchorRect.right', () => {
    // window.innerWidth is 1024 in happy-dom by default
    const { container } = renderMenu({
      anchorRect: makeRect({ top: 200, right: 500 }),
    });
    const menu = container.querySelector('.hovering-menu') as HTMLElement;
    expect(menu.style.top).toBe('200px');
    // right = window.innerWidth - anchorRect.right = 1024 - 500 = 524
    expect(menu.style.right).toBe(`${window.innerWidth - 500}px`);
    expect(menu.style.left).toBe('');
  });

  it('uses the same right position regardless of button count', () => {
    const rect = makeRect({ right: 500 });
    const expectedRight = `${window.innerWidth - 500}px`;

    const { container: both } = renderMenu({ anchorRect: rect });
    const { container: deleteOnly } = renderMenu({
      anchorRect: rect,
      actions: { deleteAction: { id: 'deleteAction' } },
    });

    const menuBoth = both.querySelector('.hovering-menu') as HTMLElement;
    const menuDelete = deleteOnly.querySelector(
      '.hovering-menu',
    ) as HTMLElement;
    expect(menuBoth.style.right).toBe(expectedRight);
    expect(menuDelete.style.right).toBe(expectedRight);
  });

  it('only shows close when deleteAction is absent', () => {
    const { getByTitle, container } = renderMenu({
      actions: { closeAction: { id: 'closeAction' } },
    });
    expect(getByTitle('Close')).toBeTruthy();
    expect(container.querySelectorAll('.hovering-menu-btn').length).toBe(1);
  });

  it('only shows delete when closeAction is absent', () => {
    const { getByTitle, container } = renderMenu({
      actions: { deleteAction: { id: 'deleteAction' } },
    });
    expect(getByTitle('Delete')).toBeTruthy();
    expect(container.querySelectorAll('.hovering-menu-btn').length).toBe(1);
  });

  it('renders note button when addNoteAction present', () => {
    const { getByTitle } = renderMenu({
      actions: {
        addNoteAction: { id: 'addNoteAction' },
        deleteAction: { id: 'deleteAction' },
      },
    });
    expect(getByTitle('Note')).toBeTruthy();
  });

  it('calls onAction with addNoteAction on note click', () => {
    const onAction = vi.fn();
    const { getByTitle } = renderMenu({
      onAction,
      actions: {
        addNoteAction: { id: 'addNoteAction' },
        deleteAction: { id: 'deleteAction' },
      },
    });
    fireEvent.click(getByTitle('Note'));
    expect(onAction).toHaveBeenCalledWith('node1', 'addNoteAction');
  });

  it('renders menu when only addNoteAction is present', () => {
    const { getByTitle, container } = renderMenu({
      actions: { addNoteAction: { id: 'addNoteAction' } },
    });
    expect(getByTitle('Note')).toBeTruthy();
    expect(container.querySelectorAll('.hovering-menu-btn').length).toBe(1);
  });
});
