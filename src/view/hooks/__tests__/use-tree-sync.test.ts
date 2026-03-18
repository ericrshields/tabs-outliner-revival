import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import type { MutableRef } from 'preact/hooks';
import type { TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import {
  makeTree,
  makeNodeDTO,
  resetFixtureCounter,
} from '../../__tests__/fixtures';
import type { MvcId } from '@/types/brands';

// Mock tree-adapter and tree-actions at module level
vi.mock('../../tree-adapter', () => ({
  buildOpenMap: vi.fn(() => ({})),
}));

vi.mock('../../tree-actions', () => ({
  requestTree: vi.fn(() => ({ request: 'request2bkg_get_tree_structure' })),
  toggleCollapse: vi.fn((id: string) => ({
    request: 'request2bkg_invertCollapsedState',
    targetNodeIdMVC: id,
  })),
  activateNode: vi.fn((id: string) => ({
    request: 'request2bkg_activateNode',
    targetNodeIdMVC: id,
  })),
  notifyUnload: vi.fn(() => ({
    request: 'request2bkg_onViewWindowBeforeUnload_saveNow',
  })),
}));

import { useTreeSync } from '../use-tree-sync';
import type { UseTreeSyncOptions } from '../use-tree-sync';
import { buildOpenMap } from '../../tree-adapter';
import { requestTree, toggleCollapse, activateNode } from '../../tree-actions';

const mockBuildOpenMap = vi.mocked(buildOpenMap);

beforeEach(() => {
  vi.clearAllMocks();
  resetFixtureCounter();
});

function makeOptions(
  overrides: Partial<UseTreeSyncOptions> = {},
): UseTreeSyncOptions {
  return {
    treeRef: { current: null } as MutableRef<TreeApi<NodeDTO> | null>,
    root: null,
    globalViewId: null,
    needsFullRefresh: false,
    postMessage: vi.fn(),
    ...overrides,
  };
}

function makeMockTreeApi() {
  return {
    open: vi.fn(),
    close: vi.fn(),
  } as unknown as TreeApi<NodeDTO>;
}

describe('useTreeSync', () => {
  it('requests tree on mount', () => {
    const postMessage = vi.fn();
    renderHook(() => useTreeSync(makeOptions({ postMessage })));

    expect(requestTree).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ request: 'request2bkg_get_tree_structure' }),
    );
  });

  it('re-requests tree when needsFullRefresh becomes true', () => {
    const postMessage = vi.fn();
    const { rerender } = renderHook(
      (props: UseTreeSyncOptions) => useTreeSync(props),
      { initialProps: makeOptions({ postMessage, needsFullRefresh: false }) },
    );

    postMessage.mockClear();
    rerender(makeOptions({ postMessage, needsFullRefresh: true }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ request: 'request2bkg_get_tree_structure' }),
    );
  });

  it('does not re-request when needsFullRefresh stays false', () => {
    const postMessage = vi.fn();
    const { rerender } = renderHook(
      (props: UseTreeSyncOptions) => useTreeSync(props),
      { initialProps: makeOptions({ postMessage }) },
    );

    // Clear mount request
    postMessage.mockClear();
    rerender(makeOptions({ postMessage }));

    // No additional request (mount request already cleared)
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('registers beforeunload handler', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useTreeSync(makeOptions()));

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('cleans up beforeunload handler on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useTreeSync(makeOptions()));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
    removeSpy.mockRestore();
  });

  describe('open/close sync', () => {
    it('performs full sync when globalViewId changes', () => {
      const mockTree = makeMockTreeApi();
      const treeRef = {
        current: mockTree,
      } as MutableRef<TreeApi<NodeDTO> | null>;
      const root = makeTree();
      mockBuildOpenMap.mockReturnValue({ win1: true, win2: false });

      const { rerender } = renderHook(
        (props: UseTreeSyncOptions) => useTreeSync(props),
        { initialProps: makeOptions({ treeRef, root, globalViewId: 1 }) },
      );

      expect(mockTree.open).toHaveBeenCalledWith('win1');
      expect(mockTree.close).toHaveBeenCalledWith('win2');

      // Change globalViewId → full sync again
      (mockTree.open as ReturnType<typeof vi.fn>).mockClear();
      (mockTree.close as ReturnType<typeof vi.fn>).mockClear();
      mockBuildOpenMap.mockReturnValue({ win1: false, win2: true });

      rerender(makeOptions({ treeRef, root, globalViewId: 2 }));

      expect(mockTree.close).toHaveBeenCalledWith('win1');
      expect(mockTree.open).toHaveBeenCalledWith('win2');
    });

    it('performs incremental sync for same globalViewId', () => {
      const mockTree = makeMockTreeApi();
      const treeRef = {
        current: mockTree,
      } as MutableRef<TreeApi<NodeDTO> | null>;
      const root = makeTree();
      mockBuildOpenMap.mockReturnValue({ win1: true, win2: false });

      const { rerender } = renderHook(
        (props: UseTreeSyncOptions) => useTreeSync(props),
        { initialProps: makeOptions({ treeRef, root, globalViewId: 1 }) },
      );

      // Clear initial full sync calls
      (mockTree.open as ReturnType<typeof vi.fn>).mockClear();
      (mockTree.close as ReturnType<typeof vi.fn>).mockClear();

      // Same globalViewId, win1 changes to closed
      const updatedRoot = makeTree();
      mockBuildOpenMap.mockReturnValue({ win1: false, win2: false });

      rerender(makeOptions({ treeRef, root: updatedRoot, globalViewId: 1 }));

      // Only win1 changed, so only win1 should be updated
      expect(mockTree.close).toHaveBeenCalledWith('win1');
      expect(mockTree.open).not.toHaveBeenCalled();
    });

    it('skips sync when treeRef.current is null', () => {
      const treeRef = { current: null } as MutableRef<TreeApi<NodeDTO> | null>;
      const root = makeTree();

      renderHook(() =>
        useTreeSync(makeOptions({ treeRef, root, globalViewId: 1 })),
      );

      // buildOpenMap should not be called when treeRef is null
      expect(mockBuildOpenMap).not.toHaveBeenCalled();
    });
  });

  describe('onToggle', () => {
    it('posts toggleCollapse message', () => {
      const postMessage = vi.fn();
      const { result } = renderHook(() =>
        useTreeSync(makeOptions({ postMessage })),
      );

      act(() => result.current.onToggle('win1'));

      expect(toggleCollapse).toHaveBeenCalledWith('win1');
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          request: 'request2bkg_invertCollapsedState',
          targetNodeIdMVC: 'win1',
        }),
      );
    });
  });

  describe('onActivate', () => {
    it('posts activateNode for non-null node', () => {
      const postMessage = vi.fn();
      const { result } = renderHook(() =>
        useTreeSync(makeOptions({ postMessage })),
      );
      const node = { data: makeNodeDTO({ idMVC: 'tab1' as MvcId }) };

      act(() => result.current.onActivate(node));

      expect(activateNode).toHaveBeenCalledWith('tab1');
    });

    it('does nothing for null node', () => {
      const postMessage = vi.fn();
      const { result } = renderHook(() =>
        useTreeSync(makeOptions({ postMessage })),
      );

      postMessage.mockClear();
      act(() => result.current.onActivate(null));

      expect(activateNode).not.toHaveBeenCalled();
    });
  });
});
