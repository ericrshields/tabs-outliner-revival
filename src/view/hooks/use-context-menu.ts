/**
 * State management for the right-click context menu.
 *
 * Manages open/close lifecycle and the cursor position + target node
 * at the time of the right-click.
 */

import { useState, useCallback } from 'react';
import type { NodeDTO } from '@/types/node-dto';

export interface ContextMenuState {
  idMVC: string;
  nodeDTO: NodeDTO;
  x: number;
  y: number;
}

export interface UseContextMenuReturn {
  contextMenuState: ContextMenuState | null;
  openContextMenu: (
    idMVC: string,
    nodeDTO: NodeDTO,
    x: number,
    y: number,
  ) => void;
  closeContextMenu: () => void;
}

export function useContextMenu(): UseContextMenuReturn {
  const [contextMenuState, setContextMenuState] =
    useState<ContextMenuState | null>(null);

  const openContextMenu = useCallback(
    (idMVC: string, nodeDTO: NodeDTO, x: number, y: number) => {
      setContextMenuState({ idMVC, nodeDTO, x, y });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  return { contextMenuState, openContextMenu, closeContextMenu };
}
