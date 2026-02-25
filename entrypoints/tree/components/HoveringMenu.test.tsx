import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { HoveringMenu } from './HoveringMenu';
import type { HoveringMenuProps } from './HoveringMenu';
import type { HoveringMenuActionId } from '@/types/node';

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

  it('positions based on anchorRect', () => {
    const { container } = renderMenu({
      anchorRect: makeRect({ top: 200, right: 500 }),
    });
    const menu = container.querySelector('.hovering-menu') as HTMLElement;
    expect(menu.style.top).toBe('200px');
    expect(menu.style.left).toBe('440px');
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
});
