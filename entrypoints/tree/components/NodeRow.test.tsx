import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import type { NodeApi, NodeRendererProps } from 'react-arborist';
import type { NodeDTO, StatsBlock } from '@/types/node-dto';
import type { MvcId } from '@/types/brands';
import type { HoveringMenuActionId, TitleBackgroundCssClass } from '@/types/node';
import { TreeContext } from './TreeContext';
import type { TreeContextValue } from './TreeContext';
import { NodeRow } from './NodeRow';
import { makeNodeDTO, resetFixtureCounter } from '@/view/__tests__/fixtures';

beforeEach(() => {
  resetFixtureCounter();
});

/** Minimal mock of react-arborist's NodeApi for rendering */
function makeNodeApi(
  data: NodeDTO,
  overrides: {
    isSelected?: boolean;
    isInternal?: boolean;
    isOpen?: boolean;
  } = {},
): NodeApi<NodeDTO> {
  const toggle = vi.fn();
  return {
    data,
    isSelected: overrides.isSelected ?? false,
    isInternal: overrides.isInternal ?? false,
    isOpen: overrides.isOpen ?? false,
    toggle,
  } as unknown as NodeApi<NodeDTO>;
}

function makeCtx(overrides: Partial<TreeContextValue> = {}): TreeContextValue {
  return {
    cursorId: null,
    onRowEnter: vi.fn(),
    onAction: vi.fn(),
    ...overrides,
  };
}

function renderNodeRow(
  nodeApi: NodeApi<NodeDTO>,
  ctx: TreeContextValue = makeCtx(),
) {
  const props: NodeRendererProps<NodeDTO> = {
    node: nodeApi,
    style: {},
    dragHandle: undefined,
    tree: {} as any,
  };
  return render(
    <TreeContext.Provider value={ctx}>
      <NodeRow {...props} />
    </TreeContext.Provider>,
  );
}

describe('NodeRow', () => {
  it('renders node text', () => {
    const data = makeNodeDTO({ nodeText: 'My Tab' });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.node-text')!.textContent).toBe('My Tab');
  });

  it('renders icon when icon is set', () => {
    const data = makeNodeDTO({ icon: 'icon-tab.png' });
    const { container } = renderNodeRow(makeNodeApi(data));
    const img = container.querySelector('.node-icon') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('icon-tab.png');
  });

  it('does not render icon when icon is empty', () => {
    const data = makeNodeDTO({ icon: '' });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.node-icon')).toBeNull();
  });

  it('applies titleCssClass to node-text', () => {
    const data = makeNodeDTO({ titleCssClass: 'savedtab' });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.node-text.savedtab')).toBeTruthy();
  });

  it('applies titleBackgroundCssClass to tree-node', () => {
    const data = makeNodeDTO({
      titleBackgroundCssClass: 'windowFrame' as TitleBackgroundCssClass,
    });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.tree-node.windowFrame')).toBeTruthy();
  });

  it('applies is-selected-tab class', () => {
    const data = makeNodeDTO({ isSelectedTab: true });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.is-selected-tab')).toBeTruthy();
  });

  it('applies is-focused-window class', () => {
    const data = makeNodeDTO({ isFocusedWindow: true });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.is-focused-window')).toBeTruthy();
  });

  it('applies cursor-node class when id matches cursorId', () => {
    const data = makeNodeDTO({ idMVC: 'cursor-test' as MvcId });
    const ctx = makeCtx({ cursorId: 'cursor-test' });
    const { container } = renderNodeRow(makeNodeApi(data), ctx);
    expect(container.querySelector('.cursor-node')).toBeTruthy();
  });

  it('does not apply cursor-node class when id does not match', () => {
    const data = makeNodeDTO({ idMVC: 'other' as MvcId });
    const ctx = makeCtx({ cursorId: 'cursor-test' });
    const { container } = renderNodeRow(makeNodeApi(data), ctx);
    expect(container.querySelector('.cursor-node')).toBeNull();
  });

  it('applies ncc- content CSS class', () => {
    const data = makeNodeDTO({ nodeContentCssClass: 'separator' });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.ncc-separator')).toBeTruthy();
  });

  it('renders arrow for internal nodes', () => {
    const data = makeNodeDTO();
    const nodeApi = makeNodeApi(data, { isInternal: true, isOpen: true });
    const { container } = renderNodeRow(nodeApi);
    expect(container.querySelector('.node-arrow')!.textContent).toBe('\u25BC');
  });

  it('renders collapsed arrow for closed internal nodes', () => {
    const data = makeNodeDTO();
    const nodeApi = makeNodeApi(data, { isInternal: true, isOpen: false });
    const { container } = renderNodeRow(nodeApi);
    expect(container.querySelector('.node-arrow')!.textContent).toBe('\u25B6');
  });

  it('renders space for leaf nodes', () => {
    const data = makeNodeDTO();
    const nodeApi = makeNodeApi(data, { isInternal: false });
    const { container } = renderNodeRow(nodeApi);
    expect(container.querySelector('.node-arrow')!.textContent).toBe(' ');
  });

  it('calls node.toggle on arrow click for internal nodes', () => {
    const data = makeNodeDTO();
    const nodeApi = makeNodeApi(data, { isInternal: true });
    const { container } = renderNodeRow(nodeApi);
    fireEvent.click(container.querySelector('.node-arrow')!);
    expect(nodeApi.toggle).toHaveBeenCalled();
  });

  it('wraps window frame nodes in WindowFrame', () => {
    const data = makeNodeDTO({
      titleBackgroundCssClass: 'windowFrame' as TitleBackgroundCssClass,
      titleCssClass: 'win',
    });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.window-frame-box.win')).toBeTruthy();
  });

  it('does not wrap tab nodes in WindowFrame', () => {
    const data = makeNodeDTO({
      titleBackgroundCssClass: 'tabFrame' as TitleBackgroundCssClass,
    });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('.window-frame-box')).toBeNull();
  });

  it('renders link when href is set', () => {
    const data = makeNodeDTO({
      href: 'https://example.com',
      nodeText: 'Example',
    });
    const { container } = renderNodeRow(makeNodeApi(data));
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('https://example.com');
    expect(link.textContent).toBe('Example');
  });

  it('does not render link when href is null', () => {
    const data = makeNodeDTO({ href: null });
    const { container } = renderNodeRow(makeNodeApi(data));
    expect(container.querySelector('a')).toBeNull();
  });

  it('applies inline custom style from nodeTextCustomStyle', () => {
    const data = makeNodeDTO({ nodeTextCustomStyle: 'color: #DAD2B4' });
    const { container } = renderNodeRow(makeNodeApi(data));
    const textEl = container.querySelector('.node-text') as HTMLElement;
    expect(textEl.style.color).toBe('#DAD2B4');
  });

  it('does not apply inline style when nodeTextCustomStyle is null', () => {
    const data = makeNodeDTO({ nodeTextCustomStyle: null });
    const { container } = renderNodeRow(makeNodeApi(data));
    const textEl = container.querySelector('.node-text') as HTMLElement;
    expect(textEl.style.color).toBe('');
  });

  it('sets title attr from tooltipText', () => {
    const data = makeNodeDTO({ tooltipText: 'My tooltip' });
    const { container } = renderNodeRow(makeNodeApi(data));
    const textEl = container.querySelector('.node-text') as HTMLElement;
    expect(textEl.title).toBe('My tooltip');
  });

  it('calls onRowEnter with data on mouseenter', () => {
    const onRowEnter = vi.fn();
    const data = makeNodeDTO({ idMVC: 'hover-test' as MvcId });
    const ctx = makeCtx({ onRowEnter });
    const { container } = renderNodeRow(makeNodeApi(data), ctx);

    // Mock getBoundingClientRect
    const treeNode = container.querySelector('.tree-node')!;
    (treeNode as HTMLElement).getBoundingClientRect = () =>
      ({ top: 10, right: 100, bottom: 34, left: 0, width: 100, height: 24, x: 0, y: 10 } as DOMRect);

    fireEvent.mouseEnter(treeNode);
    expect(onRowEnter).toHaveBeenCalledWith(
      'hover-test',
      expect.objectContaining({ idMVC: 'hover-test' }),
      expect.any(Object),
    );
  });

  it('shows stats block when collapsed with stats data', () => {
    const stats: StatsBlock = {
      activeTabsCount: 3,
      activeWinsCount: 0,
      nodesCount: 3,
    };
    const data = makeNodeDTO({
      statsBlockData: stats,
    });
    const nodeApi = makeNodeApi(data, { isInternal: true, isOpen: false });
    const { container } = renderNodeRow(nodeApi);
    expect(container.querySelector('.stats-block')).toBeTruthy();
  });

  it('hides stats block when node is open', () => {
    const stats: StatsBlock = {
      activeTabsCount: 3,
      activeWinsCount: 0,
      nodesCount: 3,
    };
    const data = makeNodeDTO({
      statsBlockData: stats,
    });
    const nodeApi = makeNodeApi(data, { isInternal: true, isOpen: true });
    const { container } = renderNodeRow(nodeApi);
    expect(container.querySelector('.stats-block')).toBeNull();
  });
});
