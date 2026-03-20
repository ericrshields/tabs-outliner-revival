/**
 * In-memory clipboard for cut/copy/paste of tree node hierarchies.
 *
 * - Cut: stores source idMVC; paste moves the node (moveHierarchy).
 * - Copy: stores source idMVC; paste clones the node (copyHierarchy).
 * - Also writes plain text to the OS clipboard via navigator.clipboard
 *   for external interoperability (best-effort, no clipboardRead permission).
 */

import { useRef, useCallback, useState } from 'react';
import type { ViewToBackgroundMessage } from '@/types/messages';
import { moveHierarchy, copyHierarchy } from '../tree-actions';

export type ClipboardKind = 'cut' | 'copy';

interface ClipboardEntry {
  sourceIdMVC: string;
  kind: ClipboardKind;
}

export interface UseClipboardOptions {
  postMessage: (msg: ViewToBackgroundMessage) => void;
}

export interface UseClipboardReturn {
  cut: (idMVC: string, nodeText: string) => void;
  copy: (idMVC: string, nodeText: string) => void;
  paste: (targetParentIdMVC: string | null, targetPosition: number) => void;
  hasClipboard: boolean;
  clearClipboard: () => void;
}

export function useClipboard({
  postMessage,
}: UseClipboardOptions): UseClipboardReturn {
  // entryRef holds the clipboard data without triggering re-renders on paste.
  const entryRef = useRef<ClipboardEntry | null>(null);
  // hasClipboard is state so the context menu / keyboard shortcut UI can react.
  const [hasClipboard, setHasClipboard] = useState(false);

  const cut = useCallback((idMVC: string, nodeText: string) => {
    entryRef.current = { sourceIdMVC: idMVC, kind: 'cut' };
    setHasClipboard(true);
    // Write plain text to the OS clipboard for external interop (best-effort).
    navigator.clipboard.writeText(nodeText).catch(() => {});
  }, []);

  const copy = useCallback((idMVC: string, nodeText: string) => {
    entryRef.current = { sourceIdMVC: idMVC, kind: 'copy' };
    setHasClipboard(true);
    navigator.clipboard.writeText(nodeText).catch(() => {});
  }, []);

  const paste = useCallback(
    (targetParentIdMVC: string | null, targetPosition: number) => {
      const entry = entryRef.current;
      if (!entry) return;

      if (entry.kind === 'cut') {
        postMessage(
          moveHierarchy(entry.sourceIdMVC, targetParentIdMVC, targetPosition),
        );
        // Cut consumes the clipboard entry.
        entryRef.current = null;
        setHasClipboard(false);
      } else {
        postMessage(
          copyHierarchy(entry.sourceIdMVC, targetParentIdMVC, targetPosition),
        );
        // Copy keeps the entry so the user can paste multiple times.
      }
    },
    [postMessage],
  );

  const clearClipboard = useCallback(() => {
    entryRef.current = null;
    setHasClipboard(false);
  }, []);

  return { cut, copy, paste, hasClipboard, clearClipboard };
}
