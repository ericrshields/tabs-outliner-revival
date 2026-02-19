import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { PortManager, onPortConnect } from '../runtime';
import type { PortState } from '../runtime';

function createFakePort(name: string) {
  const messageListeners: Array<(msg: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];

  return {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (cb: (msg: unknown) => void) => messageListeners.push(cb),
      removeListener: (cb: (msg: unknown) => void) => {
        const idx = messageListeners.indexOf(cb);
        if (idx >= 0) messageListeners.splice(idx, 1);
      },
    },
    onDisconnect: {
      addListener: (cb: () => void) => disconnectListeners.push(cb),
      removeListener: (cb: () => void) => {
        const idx = disconnectListeners.indexOf(cb);
        if (idx >= 0) disconnectListeners.splice(idx, 1);
      },
    },
    _fireMessage(msg: unknown) {
      messageListeners.forEach((cb) => cb(msg));
    },
    _fireDisconnect() {
      disconnectListeners.forEach((cb) => cb());
    },
  };
}

describe('PortManager', () => {
  let fakePort: ReturnType<typeof createFakePort>;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeBrowser.reset();
    fakePort = createFakePort('test-port');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(
      fakePort as unknown as Browser.runtime.Port,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts in disconnected state', () => {
    const pm = new PortManager({ name: 'test-port' });
    expect(pm.state).toBe('disconnected');
  });

  it('transitions to connected state on connect()', () => {
    const pm = new PortManager({ name: 'test-port' });
    const states: PortState[] = [];
    pm.onStateChange((s) => states.push(s));

    pm.connect();

    expect(pm.state).toBe('connected');
    expect(states).toEqual(['connecting', 'connected']);
    pm.dispose();
  });

  it('delivers messages from the background', () => {
    const pm = new PortManager({ name: 'test-port' });
    const messages: unknown[] = [];
    pm.onMessage((msg) => messages.push(msg));
    pm.connect();

    fakePort._fireMessage({ data: 'hello' });

    expect(messages).toEqual([{ data: 'hello' }]);
    pm.dispose();
  });

  it('sends messages through the port when connected', () => {
    const pm = new PortManager({ name: 'test-port' });
    pm.connect();

    pm.postMessage({ request: 'test' });
    expect(fakePort.postMessage).toHaveBeenCalledWith({ request: 'test' });
    pm.dispose();
  });

  it('queues messages when disconnected and flushes on reconnect', () => {
    const pm = new PortManager({
      name: 'test-port',
      reconnectBaseDelayMs: 10,
    });
    pm.connect();

    fakePort._fireDisconnect();
    expect(pm.state).toBe('connecting');

    pm.postMessage({ a: 1 });
    pm.postMessage({ b: 2 });

    const newPort = createFakePort('test-port');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(
      newPort as unknown as Browser.runtime.Port,
    );

    vi.advanceTimersByTime(10);

    expect(pm.state).toBe('connected');
    expect(newPort.postMessage).toHaveBeenCalledWith({ a: 1 });
    expect(newPort.postMessage).toHaveBeenCalledWith({ b: 2 });
    pm.dispose();
  });

  it('respects maxQueueSize', () => {
    const pm = new PortManager({
      name: 'test-port',
      maxQueueSize: 2,
    });

    pm.postMessage('msg1');
    pm.postMessage('msg2');
    pm.postMessage('msg3'); // dropped

    pm.connect();

    expect(fakePort.postMessage).toHaveBeenCalledTimes(2);
    expect(fakePort.postMessage).toHaveBeenCalledWith('msg1');
    expect(fakePort.postMessage).toHaveBeenCalledWith('msg2');
    pm.dispose();
  });

  it('sends heartbeat messages at the configured interval', () => {
    const pm = new PortManager({
      name: 'test-port',
      heartbeatIntervalMs: 100,
    });
    pm.connect();

    expect(fakePort.postMessage).not.toHaveBeenCalledWith({ __heartbeat: true });

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    const heartbeats = fakePort.postMessage.mock.calls.filter(
      (c) => c[0]?.__heartbeat === true,
    );
    expect(heartbeats).toHaveLength(2);

    pm.dispose();
  });

  it('stops heartbeat on disconnect', () => {
    const pm = new PortManager({
      name: 'test-port',
      heartbeatIntervalMs: 100,
    });
    pm.connect();

    fakePort._fireDisconnect();

    // Advance time — heartbeats should NOT fire on disconnected port
    vi.advanceTimersByTime(500);

    const heartbeats = fakePort.postMessage.mock.calls.filter(
      (c) => c[0]?.__heartbeat === true,
    );
    expect(heartbeats).toHaveLength(0);

    pm.dispose();
  });

  it('applies exponential backoff on consecutive failed reconnects', () => {
    const pm = new PortManager({
      name: 'test-port',
      reconnectBaseDelayMs: 100,
      reconnectMaxDelayMs: 1000,
    });
    pm.connect();

    fakePort._fireDisconnect();
    vi.spyOn(fakeBrowser.runtime, 'connect').mockImplementation(() => {
      throw new Error('background unavailable');
    });

    // First reconnect attempt: delay = 100ms (100 * 2^0)
    vi.advanceTimersByTime(100);
    expect(pm.state).toBe('connecting');

    // Second reconnect attempt: delay = 200ms (100 * 2^1)
    vi.advanceTimersByTime(200);
    expect(pm.state).toBe('connecting');

    // Now let it succeed
    const port2 = createFakePort('test-port');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(
      port2 as unknown as Browser.runtime.Port,
    );

    // Third reconnect attempt: delay = 400ms (100 * 2^2)
    vi.advanceTimersByTime(400);
    expect(pm.state).toBe('connected');

    pm.dispose();
  });

  it('gives up after maxReconnectAttempts', () => {
    const pm = new PortManager({
      name: 'test-port',
      reconnectBaseDelayMs: 10,
      maxReconnectAttempts: 2,
    });
    pm.connect();

    fakePort._fireDisconnect();
    vi.spyOn(fakeBrowser.runtime, 'connect').mockImplementation(() => {
      throw new Error('unavailable');
    });

    // Attempt 1 (delay 10ms)
    vi.advanceTimersByTime(10);
    expect(pm.state).toBe('connecting');

    // Attempt 2 (delay 20ms) — should be the last
    vi.advanceTimersByTime(20);
    expect(pm.state).toBe('disconnected');

    // No more attempts
    vi.advanceTimersByTime(10000);
    expect(pm.state).toBe('disconnected');

    pm.dispose();
  });

  it('queues message when connected postMessage throws', () => {
    const pm = new PortManager({ name: 'test-port' });
    pm.connect();

    // First message succeeds
    pm.postMessage('first');
    expect(fakePort.postMessage).toHaveBeenCalledWith('first');

    // Make postMessage throw (simulating port death)
    fakePort.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });

    // Should not throw to caller — silently queues
    expect(() => pm.postMessage('second')).not.toThrow();

    pm.dispose();
  });

  it('isolates listener exceptions — one throwing does not block others', () => {
    const pm = new PortManager({ name: 'test-port' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const received: unknown[] = [];

    pm.onMessage(() => {
      throw new Error('listener explodes');
    });
    pm.onMessage((msg) => received.push(msg));

    pm.connect();
    fakePort._fireMessage({ data: 'test' });

    // Second listener should still receive the message
    expect(received).toEqual([{ data: 'test' }]);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
    pm.dispose();
  });

  it('cleans up everything on dispose()', () => {
    const pm = new PortManager({ name: 'test-port' });
    pm.connect();

    const messages: unknown[] = [];
    const states: PortState[] = [];
    pm.onMessage((m) => messages.push(m));
    pm.onStateChange((s) => states.push(s));

    pm.dispose();

    expect(fakePort.disconnect).toHaveBeenCalled();
    expect(pm.state).toBe('disconnected');

    fakePort._fireMessage({ shouldNotAppear: true });
    expect(messages).toHaveLength(0);
  });

  it('does not reconnect after dispose', () => {
    const pm = new PortManager({
      name: 'test-port',
      reconnectBaseDelayMs: 10,
    });
    pm.connect();
    fakePort._fireDisconnect();

    pm.dispose();

    const port2 = createFakePort('test-port');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(
      port2 as unknown as Browser.runtime.Port,
    );
    vi.advanceTimersByTime(1000);

    expect(pm.state).toBe('disconnected');
  });

  it('ignores connect() after dispose', () => {
    const pm = new PortManager({ name: 'test-port' });
    pm.dispose();
    pm.connect();
    expect(pm.state).toBe('disconnected');
  });

  it('allows disconnect() then connect() cycle', () => {
    const pm = new PortManager({ name: 'test-port' });
    pm.connect();
    expect(pm.state).toBe('connected');

    pm.disconnect();
    expect(pm.state).toBe('disconnected');

    const port2 = createFakePort('test-port');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(
      port2 as unknown as Browser.runtime.Port,
    );
    pm.connect();
    expect(pm.state).toBe('connected');

    pm.dispose();
  });

  it('onMessage cleanup function prevents future callbacks', () => {
    const pm = new PortManager({ name: 'test-port' });
    const msgs: unknown[] = [];
    const cleanup = pm.onMessage((m) => msgs.push(m));
    pm.connect();

    fakePort._fireMessage('before');
    expect(msgs).toEqual(['before']);

    cleanup();
    fakePort._fireMessage('after');
    expect(msgs).toEqual(['before']);

    pm.dispose();
  });

  it('onStateChange cleanup function prevents future callbacks', () => {
    const pm = new PortManager({ name: 'test-port' });
    const states: PortState[] = [];
    const cleanup = pm.onStateChange((s) => states.push(s));

    pm.connect();
    expect(states).toEqual(['connecting', 'connected']);

    cleanup();
    pm.disconnect();
    // Should not receive 'disconnected'
    expect(states).toEqual(['connecting', 'connected']);
  });
});

describe('onPortConnect', () => {
  let listeners: Array<(port: Browser.runtime.Port) => void>;

  beforeEach(() => {
    fakeBrowser.reset();
    listeners = [];
    vi.spyOn(fakeBrowser.runtime.onConnect, 'addListener').mockImplementation(
      (cb: (port: Browser.runtime.Port) => void) => {
        listeners.push(cb);
      },
    );
    vi.spyOn(fakeBrowser.runtime.onConnect, 'removeListener').mockImplementation(
      (cb: (port: Browser.runtime.Port) => void) => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters by port name and returns cleanup', () => {
    const ports: Browser.runtime.Port[] = [];
    const cleanup = onPortConnect('my-port', (port) => ports.push(port));

    const matchingPort = { name: 'my-port' } as Browser.runtime.Port;
    const otherPort = { name: 'other' } as Browser.runtime.Port;

    listeners.forEach((l) => l(matchingPort));
    listeners.forEach((l) => l(otherPort));

    expect(ports).toHaveLength(1);
    expect(ports[0].name).toBe('my-port');

    cleanup();

    listeners.forEach((l) => l(matchingPort));
    expect(ports).toHaveLength(1);
  });
});
