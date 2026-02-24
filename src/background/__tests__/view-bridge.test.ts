import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewBridge } from '../view-bridge';
import type { BackgroundToViewMessage } from '@/types/messages';

function createMockPort(name = 'tree-view'): Browser.runtime.Port {
  const disconnectListeners: Array<(port: Browser.runtime.Port) => void> = [];
  const messageListeners: Array<(msg: unknown) => void> = [];

  const port: Browser.runtime.Port = {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: {
      addListener: vi.fn((cb) => disconnectListeners.push(cb)),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn((cb) => messageListeners.push(cb)),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
    },
  } as unknown as Browser.runtime.Port;

  // Expose a way to simulate disconnect
  (port as unknown as { _simulateDisconnect: () => void })._simulateDisconnect =
    () => {
      for (const cb of disconnectListeners) cb(port);
    };

  return port;
}

function simulateDisconnect(port: Browser.runtime.Port): void {
  (port as unknown as { _simulateDisconnect: () => void })._simulateDisconnect();
}

describe('ViewBridge', () => {
  let bridge: ViewBridge;

  beforeEach(() => {
    bridge = new ViewBridge();
  });

  describe('addPort()', () => {
    it('registers a port and increments portCount', () => {
      const port = createMockPort();
      bridge.addPort(port);
      expect(bridge.portCount).toBe(1);
    });

    it('registers multiple ports', () => {
      bridge.addPort(createMockPort());
      bridge.addPort(createMockPort());
      expect(bridge.portCount).toBe(2);
    });

    it('sets up onDisconnect handler for auto-removal', () => {
      const port = createMockPort();
      bridge.addPort(port);
      expect(port.onDisconnect.addListener).toHaveBeenCalled();
    });

    it('auto-removes port on disconnect', () => {
      const port = createMockPort();
      bridge.addPort(port);
      expect(bridge.portCount).toBe(1);

      simulateDisconnect(port);
      expect(bridge.portCount).toBe(0);
    });
  });

  describe('removePort()', () => {
    it('removes a specific port', () => {
      const port1 = createMockPort();
      const port2 = createMockPort();
      bridge.addPort(port1);
      bridge.addPort(port2);

      bridge.removePort(port1);
      expect(bridge.portCount).toBe(1);
    });

    it('is a no-op for unknown ports', () => {
      const port = createMockPort();
      bridge.removePort(port);
      expect(bridge.portCount).toBe(0);
    });
  });

  describe('broadcast()', () => {
    it('sends message to all connected ports', () => {
      const port1 = createMockPort();
      const port2 = createMockPort();
      bridge.addPort(port1);
      bridge.addPort(port2);

      const msg: BackgroundToViewMessage = {
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: 'test',
        doNotScrollView: false,
      };

      bridge.broadcast(msg);
      expect(port1.postMessage).toHaveBeenCalledWith(msg);
      expect(port2.postMessage).toHaveBeenCalledWith(msg);
    });

    it('removes dead ports that throw on postMessage', () => {
      const livePort = createMockPort();
      const deadPort = createMockPort();
      (deadPort.postMessage as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('port disconnected');
        },
      );

      bridge.addPort(livePort);
      bridge.addPort(deadPort);

      const msg: BackgroundToViewMessage = {
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: 'test',
        doNotScrollView: false,
      };

      bridge.broadcast(msg);
      expect(bridge.portCount).toBe(1);
      expect(livePort.postMessage).toHaveBeenCalledWith(msg);
    });

    it('is a no-op with no ports', () => {
      const msg: BackgroundToViewMessage = {
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: 'test',
        doNotScrollView: false,
      };

      // Should not throw
      bridge.broadcast(msg);
    });
  });

  describe('sendTo()', () => {
    it('sends message to a specific port', () => {
      const port = createMockPort();
      bridge.addPort(port);

      const msg: BackgroundToViewMessage = {
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: 'test',
        doNotScrollView: false,
      };

      bridge.sendTo(port, msg);
      expect(port.postMessage).toHaveBeenCalledWith(msg);
    });

    it('removes port from set if postMessage throws', () => {
      const port = createMockPort();
      (port.postMessage as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('disconnected');
      });
      bridge.addPort(port);

      const msg: BackgroundToViewMessage = {
        command: 'msg2view_setCursorHere',
        targetNodeIdMVC: 'test',
        doNotScrollView: false,
      };

      bridge.sendTo(port, msg);
      expect(bridge.portCount).toBe(0);
    });
  });

  describe('disconnectAll()', () => {
    it('disconnects all ports and clears the set', () => {
      const port1 = createMockPort();
      const port2 = createMockPort();
      bridge.addPort(port1);
      bridge.addPort(port2);

      bridge.disconnectAll();
      expect(bridge.portCount).toBe(0);
      expect(port1.disconnect).toHaveBeenCalled();
      expect(port2.disconnect).toHaveBeenCalled();
    });

    it('handles already-disconnected ports gracefully', () => {
      const port = createMockPort();
      (port.disconnect as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('already disconnected');
      });
      bridge.addPort(port);

      // Should not throw
      bridge.disconnectAll();
      expect(bridge.portCount).toBe(0);
    });
  });
});
