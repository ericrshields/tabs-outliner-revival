import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';

vi.mock('../../tree-actions', () => ({
  importTree: vi.fn((json: string) => ({
    request: 'request2bkg_import_tree',
    json,
  })),
}));

vi.mock('../../../../entrypoints/tree/components/drag-import', () => ({
  extractTreeFromDrag: vi.fn(() => null),
  readFileAsText: vi.fn(() => Promise.resolve('{"n":{}}')),
  importContainsTabs: vi.fn(() => true),
}));

import { useTreeDrop } from '../use-tree-drop';
import type { UseTreeDropOptions } from '../use-tree-drop';
import { importContainsTabs } from '../../../../entrypoints/tree/components/drag-import';

const mockImportContainsTabs = vi.mocked(importContainsTabs);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.restoreAllMocks();
});

function makeOptions(
  overrides: Partial<UseTreeDropOptions> = {},
): UseTreeDropOptions {
  return {
    postMessage: vi.fn(),
    importResult: null,
    exportJson: null,
    exportHtml: null,
    clearExport: vi.fn(),
    clearExportHtml: vi.fn(),
    ...overrides,
  };
}

describe('useTreeDrop', () => {
  describe('first-run overlay', () => {
    it('shows first-run when localStorage has no importDismissed key', () => {
      const { result } = renderHook(() => useTreeDrop(makeOptions()));
      expect(result.current.showFirstRun).toBe(true);
    });

    it('hides first-run when localStorage has importDismissed key', () => {
      localStorage.setItem('importDismissed', 'true');
      const { result } = renderHook(() => useTreeDrop(makeOptions()));
      expect(result.current.showFirstRun).toBe(false);
    });

    it('dismissFirstRun sets localStorage and hides overlay', () => {
      const { result } = renderHook(() => useTreeDrop(makeOptions()));
      expect(result.current.showFirstRun).toBe(true);

      act(() => result.current.dismissFirstRun());

      expect(result.current.showFirstRun).toBe(false);
      expect(localStorage.getItem('importDismissed')).toBe('true');
    });

    it('auto-dismisses on successful import result', () => {
      const { result, rerender } = renderHook(
        (props: UseTreeDropOptions) => useTreeDrop(props),
        { initialProps: makeOptions() },
      );
      expect(result.current.showFirstRun).toBe(true);

      rerender(makeOptions({ importResult: { success: true, nodeCount: 5 } }));

      expect(result.current.showFirstRun).toBe(false);
    });
  });

  describe('handleImport', () => {
    it('posts importTree message for valid import with tabs', () => {
      const postMessage = vi.fn();
      mockImportContainsTabs.mockReturnValue(true);
      const { result } = renderHook(() =>
        useTreeDrop(makeOptions({ postMessage })),
      );

      act(() => result.current.handleImport('{"n":{}}'));

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ request: 'request2bkg_import_tree' }),
      );
    });

    it('shows confirm dialog when import has no tabs', () => {
      const postMessage = vi.fn();
      mockImportContainsTabs.mockReturnValue(false);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { result } = renderHook(() =>
        useTreeDrop(makeOptions({ postMessage })),
      );

      act(() => result.current.handleImport('{"n":{"type":"savedwin"}}'));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('does not import when confirm is cancelled', () => {
      const postMessage = vi.fn();
      mockImportContainsTabs.mockReturnValue(false);
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { result } = renderHook(() =>
        useTreeDrop(makeOptions({ postMessage })),
      );

      act(() => result.current.handleImport('{"n":{"type":"savedwin"}}'));

      expect(postMessage).not.toHaveBeenCalled();
    });

    it('imports when confirm is accepted', () => {
      const postMessage = vi.fn();
      mockImportContainsTabs.mockReturnValue(false);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { result } = renderHook(() =>
        useTreeDrop(makeOptions({ postMessage })),
      );

      act(() => result.current.handleImport('{"n":{"type":"savedwin"}}'));

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ request: 'request2bkg_import_tree' }),
      );
    });
  });

  describe('external drag-drop', () => {
    it('sets isExternalDragOver for external drag types', () => {
      const { result } = renderHook(() => useTreeDrop(makeOptions()));
      expect(result.current.isExternalDragOver).toBe(false);

      const event = {
        dataTransfer: { types: ['text/html'] },
        preventDefault: vi.fn(),
      };

      act(() => result.current.handleTreeDragOver(event as any));

      expect(result.current.isExternalDragOver).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('resets on drag leave', () => {
      const { result } = renderHook(() => useTreeDrop(makeOptions()));

      // Trigger drag over first
      const event = {
        dataTransfer: { types: ['text/html'] },
        preventDefault: vi.fn(),
      };
      act(() => result.current.handleTreeDragOver(event as any));
      expect(result.current.isExternalDragOver).toBe(true);

      act(() => result.current.handleTreeDragLeave());
      expect(result.current.isExternalDragOver).toBe(false);
    });
  });

  describe('export download', () => {
    it('triggers download and calls clearExport when exportJson set', () => {
      const clearExport = vi.fn();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, 'appendChild');

      renderHook(() =>
        useTreeDrop(makeOptions({ exportJson: '{"test":true}', clearExport })),
      );

      expect(clearExport).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      // Find the appended anchor among all appendChild calls (Preact also appends)
      const anchorCall = appendSpy.mock.calls.find(
        ([el]) => (el as HTMLElement).tagName === 'A',
      );
      expect(anchorCall).toBeTruthy();
      const anchor = anchorCall![0] as HTMLAnchorElement;
      expect(anchor.download).toMatch(/tabs-outliner-backup/);
    });

    it('does nothing when exportJson is null', () => {
      const clearExport = vi.fn();

      renderHook(() =>
        useTreeDrop(makeOptions({ exportJson: null, clearExport })),
      );

      expect(clearExport).not.toHaveBeenCalled();
    });

    it('triggers HTML download and calls clearExportHtml when exportHtml set', () => {
      const clearExportHtml = vi.fn();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-html');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, 'appendChild');

      renderHook(() =>
        useTreeDrop(
          makeOptions({ exportHtml: '<li>test</li>', clearExportHtml }),
        ),
      );

      expect(clearExportHtml).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      const anchorCall = appendSpy.mock.calls.find(
        ([el]) => (el as HTMLElement).tagName === 'A',
      );
      expect(anchorCall).toBeTruthy();
      const anchor = anchorCall![0] as HTMLAnchorElement;
      expect(anchor.download).toMatch(/\.html$/);
      expect(anchor.href).toBe('blob:test-html');
    });
  });
});
