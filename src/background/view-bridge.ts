/**
 * ViewBridge — port connection management for background↔view communication.
 *
 * Manages the set of connected view ports, provides broadcast and
 * point-to-point messaging, and automatically cleans up dead ports.
 */

import type { BackgroundToViewMessage } from '@/types/messages';

export class ViewBridge {
  private readonly _ports = new Set<Browser.runtime.Port>();

  /** Register a view port connection. */
  addPort(port: Browser.runtime.Port): void {
    this._ports.add(port);
    port.onDisconnect.addListener(() => {
      this._ports.delete(port);
    });
  }

  /** Remove a disconnected port. */
  removePort(port: Browser.runtime.Port): void {
    this._ports.delete(port);
  }

  /** Broadcast a message to all connected views. Removes dead ports on error. */
  broadcast(msg: BackgroundToViewMessage): void {
    const dead: Browser.runtime.Port[] = [];
    for (const port of this._ports) {
      try {
        port.postMessage(msg);
      } catch {
        dead.push(port);
      }
    }
    for (const port of dead) {
      this._ports.delete(port);
    }
  }

  /** Send a message to a specific port. */
  sendTo(port: Browser.runtime.Port, msg: BackgroundToViewMessage): void {
    try {
      port.postMessage(msg);
    } catch {
      this._ports.delete(port);
    }
  }

  /** Number of connected views. */
  get portCount(): number {
    return this._ports.size;
  }

  /** Disconnect all ports and clear the set. */
  disconnectAll(): void {
    for (const port of this._ports) {
      try {
        port.disconnect();
      } catch {
        // Port may already be disconnected
      }
    }
    this._ports.clear();
  }
}
