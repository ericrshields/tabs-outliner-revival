/**
 * In-memory clipboard for cut/copy/paste of tree node hierarchies.
 *
 * - Cut: stores source idMVC; paste moves the node (moveHierarchy).
 * - Copy: stores source idMVC; paste clones the node (copyHierarchy).
 * - Also writes plain text to the OS clipboard via navigator.clipboard
 *   for external interoperability (best-effort, no clipboardRead permission).
 */

import { useCallback, useRef, useState } from 'react';
import type { ViewToBackgroundMessage } from '@/types/messages';
import { moveHierarchy, copyHierarchy } from '../tree-actions';

export type ClipboardKind = 'cut' | 'copy';

export interface ClipboardEntry {
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
  /**
   * The current clipboard entry, or null if empty. Drives row-level visual
   * indicators (faded for cut, tinted for copy). Updates only on
   * cut/copy/clearClipboard — paste does not change the entry, so the tree
   * doesn't re-render every time a paste fires.
   */
  entry: ClipboardEntry | null;
  clearClipboard: () => void;
}

export function useClipboard({
  postMessage,
}: UseClipboardOptions): UseClipboardReturn {
  // Two views of the same value:
  //  - `entry` (state) drives reactive consumers (TreeContext → row visual).
  //  - `entryRef` lets `paste` read the latest value synchronously without
  //    needing `entry` in its dep list, which would invalidate the callback
  //    identity every cut/copy and re-bind every consumer's keyboard hook.
  const [entry, setEntry] = useState<ClipboardEntry | null>(null);
  const entryRef = useRef<ClipboardEntry | null>(null);

  const cut = useCallback((idMVC: string, nodeText: string) => {
    const next: ClipboardEntry = { sourceIdMVC: idMVC, kind: 'cut' };
    entryRef.current = next;
    setEntry(next);
    // Write plain text to the OS clipboard for external interop (best-effort).
    navigator.clipboard.writeText(nodeText).catch(() => {});
  }, []);

  const copy = useCallback((idMVC: string, nodeText: string) => {
    const next: ClipboardEntry = { sourceIdMVC: idMVC, kind: 'copy' };
    entryRef.current = next;
    setEntry(next);
    navigator.clipboard.writeText(nodeText).catch(() => {});
  }, []);

  const paste = useCallback(
    (targetParentIdMVC: string | null, targetPosition: number) => {
      const e = entryRef.current;
      if (!e) return;

      if (e.kind === 'cut') {
        postMessage(
          moveHierarchy(e.sourceIdMVC, targetParentIdMVC, targetPosition),
        );
        // Transition cut → copy after the move fires. The node keeps its
        // idMVC at the new location, so subsequent pastes clone from there
        // — one consistent multi-paste lifecycle for both kinds. Avoids
        // the awkward case where a second paste of a cut tries to move a
        // node "right after itself" (no-op when the focus is the
        // just-moved node) and feels broken. Visual: the dashed outline
        // drops on the next render, the blue tint persists.
        const next: ClipboardEntry = {
          sourceIdMVC: e.sourceIdMVC,
          kind: 'copy',
        };
        entryRef.current = next;
        setEntry(next);
      } else {
        postMessage(
          copyHierarchy(e.sourceIdMVC, targetParentIdMVC, targetPosition),
        );
        // Copy keeps the entry so the user can paste multiple times.
      }
    },
    [postMessage],
  );

  const clearClipboard = useCallback(() => {
    entryRef.current = null;
    setEntry(null);
  }, []);

  return {
    cut,
    copy,
    paste,
    hasClipboard: entry !== null,
    entry,
    clearClipboard,
  };
}
