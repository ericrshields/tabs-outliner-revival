/**
 * Hook managing external drag-drop import, file drop, first-run overlay,
 * the shared handleImport callback, and export download side-effect.
 */

import { useEffect, useCallback, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { ViewToBackgroundMessage } from '@/types/messages';
import type { ImportResultState } from './use-tree-data';
import { importTree } from '../tree-actions';
import {
  extractTreeFromDrag,
  readFileAsText,
  importContainsTabs,
  parseHtmlFile,
} from '../../../entrypoints/tree/components/drag-import';

const FIRST_RUN_KEY = 'importDismissed';

/** Delay before revoking blob URL — allows browser download machinery to capture the blob. */
const URL_REVOCATION_DELAY_MS = 100;

export interface UseTreeDropOptions {
  postMessage: (msg: ViewToBackgroundMessage) => void;
  importResult: ImportResultState | null;
  exportJson: string | null;
  exportHtml: string | null;
  clearExport: () => void;
  clearExportHtml: () => void;
}

export interface UseTreeDropReturn {
  showFirstRun: boolean;
  dismissFirstRun: () => void;
  isExternalDragOver: boolean;
  handleTreeDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  handleTreeDragLeave: () => void;
  handleTreeDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  handleImport: (json: string) => void;
}

export function useTreeDrop({
  postMessage,
  importResult,
  exportJson,
  exportHtml,
  clearExport,
  clearExportHtml,
}: UseTreeDropOptions): UseTreeDropReturn {
  // First-run overlay: shown until dismissed or import succeeds
  const [showFirstRun, setShowFirstRun] = useState(
    () => !localStorage.getItem(FIRST_RUN_KEY),
  );

  const dismissFirstRun = useCallback(() => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    setShowFirstRun(false);
  }, []);

  // Auto-dismiss after successful import
  useEffect(() => {
    if (importResult?.success) {
      dismissFirstRun();
    }
  }, [importResult, dismissFirstRun]);

  // Import handler shared by overlay and tree container drop
  const handleImport = useCallback(
    (json: string) => {
      if (!importContainsTabs(json)) {
        const proceed = window.confirm(
          'This import appears to contain no tab data (only empty window shells). ' +
          'This can happen when dragging collapsed nodes from the legacy extension.\n\n' +
          'Import anyway?',
        );
        if (!proceed) return;
      }
      postMessage(importTree(json));
    },
    [postMessage],
  );

  // External drop on tree container (legacy extension DnD)
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);

  const handleTreeDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    // Only handle external drags (not react-arborist internal ones)
    const dt = e.dataTransfer;
    if (!dt) return;
    const types = Array.from(dt.types);
    const isExternal =
      types.includes('application/x-tabsoutliner-items') ||
      types.includes('text/html') ||
      types.includes('Files');
    if (isExternal) {
      e.preventDefault();
      setIsExternalDragOver(true);
    }
  }, []);

  const handleTreeDragLeave = useCallback(() => {
    setIsExternalDragOver(false);
  }, []);

  const handleTreeDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer) return;

      // Try extracting tree data from legacy extension DnD
      const treeJson = extractTreeFromDrag(e.dataTransfer);
      if (treeJson) {
        e.preventDefault();
        setIsExternalDragOver(false);
        handleImport(treeJson);
        return;
      }

      // File drop
      const file = e.dataTransfer.files?.[0];
      if (file) {
        e.preventDefault();
        setIsExternalDragOver(false);
        void readFileAsText(file).then((text) => {
          // HTML files need client-side parsing — the background only handles JSON
          if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
            const treeJson = parseHtmlFile(text);
            if (treeJson) {
              handleImport(treeJson);
            }
            return;
          }
          handleImport(text);
        });
      }
    },
    [handleImport],
  );

  // Trigger file download when JSON export is ready
  useEffect(() => {
    if (!exportJson) return;
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabs-outliner-backup-${new Date().toISOString().slice(0, 10)}.tree`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Defer revocation to ensure download starts before the URL is invalidated
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, URL_REVOCATION_DELAY_MS);
    // Reset so a subsequent export triggers a new download
    clearExport();
  }, [exportJson, clearExport]);

  // Trigger file download when HTML export is ready
  useEffect(() => {
    if (!exportHtml) return;
    const blob = new Blob([exportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabs-outliner-backup-${new Date().toISOString().slice(0, 10)}.html`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, URL_REVOCATION_DELAY_MS);
    clearExportHtml();
  }, [exportHtml, clearExportHtml]);

  return {
    showFirstRun,
    dismissFirstRun,
    isExternalDragOver,
    handleTreeDragOver,
    handleTreeDragLeave,
    handleTreeDrop,
    handleImport,
  };
}
