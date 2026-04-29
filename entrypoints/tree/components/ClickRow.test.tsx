import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import type { NodeApi, RowRendererProps } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import { TreeContext } from './TreeContext';
import type { TreeContextValue } from './TreeContext';
import { ClickRow } from './ClickRow';

function makeNodeApi(overrides: { isSelected?: boolean } = {}) {
  return {
    isSelected: overrides.isSelected ?? false,
    data: { idMVC: 'test-node-1' } as NodeDTO,
    select: vi.fn(),
    activate: vi.fn(),
    deselect: vi.fn(),
    selectMulti: vi.fn(),
    selectContiguous: vi.fn(),
  } as unknown as NodeApi<NodeDTO>;
}

function makeCtx(overrides: Partial<TreeContextValue> = {}): TreeContextValue {
  return {
    cursorId: null,
    hoveredId: null,
    singleClickActivation: false,
    onRowEnter: vi.fn(),
    onAction: vi.fn(),
    editingId: null,
    editDefaultText: '',
    onEditComplete: vi.fn(),
    onEditCancel: vi.fn(),
    onContextMenu: vi.fn(),
    onNodeClick: vi.fn(),
    hasClipboard: false,
    isScrolling: false,
    clipboardSourceId: null,
    clipboardKind: null,
    ...overrides,
  };
}

function renderClickRow(
  nodeApi: NodeApi<NodeDTO>,
  ctx: TreeContextValue = makeCtx(),
) {
  const props: RowRendererProps<NodeDTO> = {
    node: nodeApi,
    innerRef: vi.fn(),
    attrs: { role: 'treeitem' },
    children: <span>child</span>,
  };
  return render(
    <TreeContext.Provider value={ctx}>
      <ClickRow {...props} />
    </TreeContext.Provider>,
  );
}

describe('ClickRow', () => {
  describe('default mode (double-click activation)', () => {
    it('single click selects without activating', () => {
      const node = makeNodeApi();
      const { container } = renderClickRow(node);
      fireEvent.click(container.querySelector('[role="treeitem"]')!);
      // fireEvent.click emits only the click event (no mousedown), so this
      // exercises the click path alone and confirms it still selects.
      expect(node.select).toHaveBeenCalledTimes(1);
      expect(node.activate).not.toHaveBeenCalled();
    });

    it('double click activates', () => {
      const node = makeNodeApi();
      const { container } = renderClickRow(node);
      fireEvent.dblClick(container.querySelector('[role="treeitem"]')!);
      expect(node.activate).toHaveBeenCalled();
    });
  });

  describe('single-click activation mode', () => {
    it('single click selects and activates', () => {
      const node = makeNodeApi();
      const ctx = makeCtx({ singleClickActivation: true });
      const { container } = renderClickRow(node, ctx);
      fireEvent.click(container.querySelector('[role="treeitem"]')!, {
        detail: 1,
      });
      expect(node.select).toHaveBeenCalled();
      expect(node.activate).toHaveBeenCalled();
    });

    it('double click does not activate', () => {
      const node = makeNodeApi();
      const ctx = makeCtx({ singleClickActivation: true });
      const { container } = renderClickRow(node, ctx);
      fireEvent.dblClick(container.querySelector('[role="treeitem"]')!);
      expect(node.activate).not.toHaveBeenCalled();
    });

    it('second click of a double-click does not duplicate activation', () => {
      const node = makeNodeApi();
      const ctx = makeCtx({ singleClickActivation: true });
      const { container } = renderClickRow(node, ctx);
      const el = container.querySelector('[role="treeitem"]')!;
      // Browser fires click(detail=1), click(detail=2), dblclick on double-click.
      // Only detail=1 should trigger activate.
      fireEvent.click(el, { detail: 1 });
      fireEvent.click(el, { detail: 2 });
      expect(node.activate).toHaveBeenCalledTimes(1);
    });
  });

  describe('multi-selection', () => {
    it('meta+click on unselected node calls selectMulti', () => {
      const node = makeNodeApi({ isSelected: false });
      const { container } = renderClickRow(node);
      fireEvent.click(container.querySelector('[role="treeitem"]')!, {
        metaKey: true,
      });
      expect(node.selectMulti).toHaveBeenCalled();
      expect(node.activate).not.toHaveBeenCalled();
    });

    it('meta+click on selected node calls deselect', () => {
      const node = makeNodeApi({ isSelected: true });
      const { container } = renderClickRow(node);
      fireEvent.click(container.querySelector('[role="treeitem"]')!, {
        metaKey: true,
      });
      expect(node.deselect).toHaveBeenCalled();
      expect(node.activate).not.toHaveBeenCalled();
    });

    it('shift+click calls selectContiguous', () => {
      const node = makeNodeApi();
      const { container } = renderClickRow(node);
      fireEvent.click(container.querySelector('[role="treeitem"]')!, {
        shiftKey: true,
      });
      expect(node.selectContiguous).toHaveBeenCalled();
      expect(node.activate).not.toHaveBeenCalled();
    });
  });

  describe('mousedown selection (survives scroll-during-click)', () => {
    it('selects on left-button mousedown with no modifiers', () => {
      const node = makeNodeApi();
      const ctx = makeCtx();
      const { container } = renderClickRow(node, ctx);
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 0,
      });
      expect(ctx.onNodeClick).toHaveBeenCalledWith('test-node-1');
      expect(node.select).toHaveBeenCalled();
    });

    it('selects when mousedown fires without a following click', () => {
      // Simulates the real scenario: the row scrolls out from under the
      // pointer between press and release, so the browser never fires
      // `click`. Selection must still be applied from the mousedown alone.
      const node = makeNodeApi();
      const ctx = makeCtx();
      const { container } = renderClickRow(node, ctx);
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 0,
      });
      expect(ctx.onNodeClick).toHaveBeenCalledWith('test-node-1');
      expect(node.select).toHaveBeenCalledTimes(1);
    });

    it('does not activate on mousedown even in single-click mode', () => {
      const node = makeNodeApi();
      const ctx = makeCtx({ singleClickActivation: true });
      const { container } = renderClickRow(node, ctx);
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 0,
      });
      expect(node.activate).not.toHaveBeenCalled();
    });

    it('ignores right-click and middle-click mousedown', () => {
      const node = makeNodeApi();
      const { container } = renderClickRow(node);
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 2,
      });
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 1,
      });
      expect(node.select).not.toHaveBeenCalled();
    });

    it('ignores modifier mousedowns — click handles those', () => {
      const node = makeNodeApi();
      const { container } = renderClickRow(node);
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 0,
        metaKey: true,
      });
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 0,
        shiftKey: true,
      });
      expect(node.select).not.toHaveBeenCalled();
      expect(node.selectMulti).not.toHaveBeenCalled();
      expect(node.selectContiguous).not.toHaveBeenCalled();
    });

    it('ignores mousedown while editing', () => {
      const node = makeNodeApi();
      const ctx = makeCtx({ editingId: 'some-id' });
      const { container } = renderClickRow(node, ctx);
      fireEvent.mouseDown(container.querySelector('[role="treeitem"]')!, {
        button: 0,
      });
      expect(node.select).not.toHaveBeenCalled();
    });
  });

  it('renders children', () => {
    const node = makeNodeApi();
    const { container } = renderClickRow(node);
    expect(container.textContent).toContain('child');
  });
});
