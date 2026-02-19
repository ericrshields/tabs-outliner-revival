/**
 * Port management with auto-reconnection, heartbeat, and message queuing.
 *
 * Addresses B1 (service worker sleep) by keeping the connection alive via
 * setInterval heartbeat and automatically reconnecting when disconnected.
 *
 * ## Usage (view side)
 *
 * ```ts
 * const port = new PortManager({ name: 'tree-view' });
 * port.onMessage((msg) => handleMessage(msg));
 * port.onStateChange((state) => updateConnectionUI(state));
 * port.connect();
 *
 * // Messages are queued when disconnected and flushed on reconnect
 * port.postMessage({ request: 'getTreeStructure' });
 *
 * // Full cleanup when done
 * port.dispose();
 * ```
 *
 * ## Usage (background side)
 *
 * ```ts
 * const cleanup = onPortConnect('tree-view', (port) => {
 *   port.onMessage.addListener((msg) => handleViewMessage(msg, port));
 * });
 * ```
 */

import { browser } from 'wxt/browser';

export type PortState = 'disconnected' | 'connecting' | 'connected';

export interface PortManagerOptions {
  /** Port name — must match between view and background. */
  name: string;
  /** Heartbeat interval in ms. Default: 25000 (under 30s SW timeout). */
  heartbeatIntervalMs?: number;
  /** Initial delay before first reconnect attempt. Default: 1000. */
  reconnectBaseDelayMs?: number;
  /** Maximum delay between reconnect attempts. Default: 30000. */
  reconnectMaxDelayMs?: number;
  /** Maximum queued messages while disconnected. Default: 100. */
  maxQueueSize?: number;
  /** Maximum reconnect attempts before giving up. Default: Infinity. */
  maxReconnectAttempts?: number;
}

type MessageCallback = (msg: unknown) => void;
type StateCallback = (state: PortState) => void;

/**
 * Client-side port manager with auto-reconnection and message queuing.
 *
 * State machine: disconnected → connecting → connected
 *                                    ↑          ↓
 *                                    └──────────┘ (on disconnect)
 */
export class PortManager {
  private _state: PortState = 'disconnected';
  private _port: Browser.runtime.Port | null = null;
  private _queue: unknown[] = [];
  private _messageListeners = new Set<MessageCallback>();
  private _stateListeners = new Set<StateCallback>();
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempt = 0;
  private _disposed = false;

  private readonly _name: string;
  private readonly _heartbeatIntervalMs: number;
  private readonly _reconnectBaseDelayMs: number;
  private readonly _reconnectMaxDelayMs: number;
  private readonly _maxQueueSize: number;
  private readonly _maxReconnectAttempts: number;

  constructor(options: PortManagerOptions) {
    this._name = options.name;
    this._heartbeatIntervalMs = options.heartbeatIntervalMs ?? 25_000;
    this._reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1_000;
    this._reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 30_000;
    this._maxQueueSize = options.maxQueueSize ?? 100;
    this._maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
  }

  get state(): PortState {
    return this._state;
  }

  /** Initiate a connection to the background service worker. */
  connect(): void {
    if (this._disposed) return;
    if (this._state !== 'disconnected') return;

    this._setState('connecting');
    this._reconnectAttempt = 0;
    this._doConnect();
  }

  /** Gracefully disconnect. Does not trigger auto-reconnect. */
  disconnect(): void {
    this._clearTimers();
    if (this._port) {
      this._port.disconnect();
      this._port = null;
    }
    this._setState('disconnected');
  }

  /**
   * Send a message to the background. If disconnected, the message is
   * queued and flushed when the connection is re-established.
   */
  postMessage(msg: unknown): void {
    if (this._state === 'connected' && this._port) {
      try {
        this._port.postMessage(msg);
      } catch {
        // Port died but onDisconnect hasn't fired yet — queue for retry
        if (this._queue.length < this._maxQueueSize) {
          this._queue.push(msg);
        }
      }
    } else {
      if (this._queue.length < this._maxQueueSize) {
        this._queue.push(msg);
      }
    }
  }

  /** Subscribe to messages from the background. Returns a cleanup function. */
  onMessage(cb: MessageCallback): () => void {
    this._messageListeners.add(cb);
    return () => this._messageListeners.delete(cb);
  }

  /** Subscribe to state changes. Returns a cleanup function. */
  onStateChange(cb: StateCallback): () => void {
    this._stateListeners.add(cb);
    return () => this._stateListeners.delete(cb);
  }

  /** Full cleanup — disconnect, clear queues, remove all listeners. */
  dispose(): void {
    this._disposed = true;
    this.disconnect();
    this._queue.length = 0;
    this._messageListeners.clear();
    this._stateListeners.clear();
  }

  // --- Internals ---

  private _doConnect(): void {
    try {
      this._port = browser.runtime.connect({ name: this._name });

      this._port.onMessage.addListener((msg: unknown) => {
        for (const cb of this._messageListeners) {
          try {
            cb(msg);
          } catch (e) {
            console.error('PortManager: message listener threw', e);
          }
        }
      });

      this._port.onDisconnect.addListener(() => {
        this._port = null;
        this._stopHeartbeat();

        if (this._disposed) {
          this._setState('disconnected');
          return;
        }

        this._setState('connecting');
        this._scheduleReconnect();
      });

      // Connection established
      this._setState('connected');
      this._reconnectAttempt = 0;
      this._startHeartbeat();
      this._flushQueue();
    } catch {
      // connect() itself can throw if the background is unavailable
      this._setState('connecting');
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (this._disposed) return;

    if (this._reconnectAttempt >= this._maxReconnectAttempts) {
      this._setState('disconnected');
      return;
    }

    const delay = Math.min(
      this._reconnectBaseDelayMs * 2 ** this._reconnectAttempt,
      this._reconnectMaxDelayMs,
    );
    this._reconnectAttempt++;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._disposed) {
        this._doConnect();
      }
    }, delay);
  }

  private _flushQueue(): void {
    if (!this._port) return;
    while (this._queue.length > 0) {
      try {
        this._port.postMessage(this._queue[0]);
        this._queue.shift();
      } catch {
        // Port died mid-flush — remaining messages stay queued for next reconnect
        return;
      }
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._port) {
        this._port.postMessage({ __heartbeat: true });
      }
    }, this._heartbeatIntervalMs);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer != null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _clearTimers(): void {
    this._stopHeartbeat();
    if (this._reconnectTimer != null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _setState(state: PortState): void {
    if (this._state === state) return;
    this._state = state;
    for (const cb of this._stateListeners) {
      try {
        cb(state);
      } catch (e) {
        console.error('PortManager: state listener threw', e);
      }
    }
  }
}

/** Background-side: listen for incoming port connections by name. */
export function onPortConnect(
  name: string,
  cb: (port: Browser.runtime.Port) => void,
): () => void {
  const listener = (port: Browser.runtime.Port) => {
    if (port.name === name) {
      cb(port);
    }
  };
  browser.runtime.onConnect.addListener(listener);
  return () => browser.runtime.onConnect.removeListener(listener);
}
