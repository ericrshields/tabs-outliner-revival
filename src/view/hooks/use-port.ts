/**
 * Preact hook wrapping PortManager lifecycle.
 *
 * Creates a PortManager on mount, subscribes to messages and state changes,
 * and disposes on unmount. Detects reconnection (not first connect) and
 * calls `onReconnect` so the consumer can re-request state.
 *
 * Callbacks are stored in refs to avoid re-subscribing PortManager
 * listeners on every render.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PortManager, type PortState } from '@/chrome/runtime';
import type { BackgroundToViewMessage, ViewToBackgroundMessage } from '@/types/messages';

export interface UsePortReturn {
  postMessage: (msg: ViewToBackgroundMessage) => void;
  connectionState: PortState;
  isConnected: boolean;
}

export function usePort(
  onMessage: (msg: BackgroundToViewMessage) => void,
  onReconnect: () => void,
): UsePortReturn {
  const [connectionState, setConnectionState] = useState<PortState>('disconnected');
  const portRef = useRef<PortManager | null>(null);
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  const hasConnectedRef = useRef(false);

  // Keep callback refs up to date without re-subscribing
  onMessageRef.current = onMessage;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    const port = new PortManager({ name: 'tree-view' });
    portRef.current = port;

    port.onMessage((msg) => {
      onMessageRef.current(msg as BackgroundToViewMessage);
    });

    port.onStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        if (hasConnectedRef.current) {
          onReconnectRef.current();
        }
        hasConnectedRef.current = true;
      }
    });

    port.connect();

    return () => {
      port.dispose();
      portRef.current = null;
    };
  }, []);

  const postMessage = useCallback((msg: ViewToBackgroundMessage) => {
    portRef.current?.postMessage(msg);
  }, []);

  return {
    postMessage,
    connectionState,
    isConnected: connectionState === 'connected',
  };
}
