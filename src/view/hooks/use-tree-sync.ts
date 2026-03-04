/**
 * Hook managing react-arborist open/close sync with background tree state,
 * mount/refresh lifecycle, unload notification, and toggle/activate callbacks.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { MutableRef } from 'preact/hooks';
import type { TreeApi } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import type { ViewToBackgroundMessage } from '@/types/messages';
import { buildOpenMap } from '../tree-adapter';
import {
  requestTree,
  toggleCollapse,
  activateNode,
  notifyUnload,
} from '../tree-actions';

export interface UseTreeSyncOptions {
  treeRef: MutableRef<TreeApi<NodeDTO> | null>;
  root: NodeDTO | null;
  globalViewId: number | null;
  needsFullRefresh: boolean;
  postMessage: (msg: ViewToBackgroundMessage) => void;
}

export interface UseTreeSyncReturn {
  onToggle: (id: string) => void;
  onActivate: (node: { data: NodeDTO } | null) => void;
}

export function useTreeSync({
  treeRef,
  root,
  globalViewId,
  needsFullRefresh,
  postMessage,
}: UseTreeSyncOptions): UseTreeSyncReturn {
  // Guard: suppress onToggle during programmatic open/close sync
  const isSyncingRef = useRef(false);
  const prevOpenMapRef = useRef<Record<string, boolean> | null>(null);
  const prevViewIdRef = useRef<number | null>(null);

  // Request tree on mount
  useEffect(() => {
    postMessage(requestTree());
  }, [postMessage]);

  // Re-request tree when background signals a structural change
  useEffect(() => {
    if (needsFullRefresh) {
      postMessage(requestTree());
    }
  }, [needsFullRefresh, postMessage]);

  // Best-effort save on unload
  useEffect(() => {
    const handler = () => postMessage(notifyUnload());
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [postMessage]);

  // Sync react-arborist open/close state from background updates.
  // On full tree replacement (new globalViewId), reset tracking so we
  // do a full sync instead of incremental diff.
  useEffect(() => {
    if (!treeRef.current || !root) return;

    // Detect full tree replacement (import, reconnect)
    const isFullReplacement = globalViewId !== prevViewIdRef.current;
    prevViewIdRef.current = globalViewId;

    const currentMap = buildOpenMap(root);
    const prev = prevOpenMapRef.current;

    const tree = treeRef.current!;
    if (!tree.open || !tree.close) {
      // Tree API not fully initialized (e.g., test environment)
      prevOpenMapRef.current = currentMap;
      return;
    }

    isSyncingRef.current = true;
    try {
      if (isFullReplacement || !prev) {
        // Full sync — apply all open/close states
        for (const [id, isOpen] of Object.entries(currentMap)) {
          if (isOpen) tree.open(id);
          else tree.close(id);
        }
      } else {
        // Incremental sync — only apply differences
        for (const [id, isOpen] of Object.entries(currentMap)) {
          if (prev[id] === undefined) continue;
          if (prev[id] !== isOpen) {
            if (isOpen) tree.open(id);
            else tree.close(id);
          }
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
    prevOpenMapRef.current = currentMap;
  }, [root, globalViewId, treeRef]);

  const onToggle = useCallback(
    (id: string) => {
      // Skip programmatic toggles from sync effect
      if (isSyncingRef.current) return;
      postMessage(toggleCollapse(id));
    },
    [postMessage],
  );

  const onActivate = useCallback(
    (node: { data: NodeDTO } | null) => {
      if (node) {
        postMessage(activateNode(node.data.idMVC));
      }
    },
    [postMessage],
  );

  return { onToggle, onActivate };
}
