import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wireViewPort } from '../view-port-setup';
import { ViewBridge } from '../view-bridge';
import type { ActiveSession } from '../active-session';
import type { ViewToBackgroundMessage } from '@/types/messages';

const handleViewMessageMock = vi.fn();

vi.mock('../message-handlers', () => ({
  handleViewMessage: (
    ...args: Parameters<typeof handleViewMessageMock>
  ): void => {
    handleViewMessageMock(...args);
  },
}));

interface FakePort {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onMessage: {
    addListener: (cb: (msg: unknown) => void) => void;
    removeListener: () => void;
  };
  onDisconnect: {
    addListener: (cb: () => void) => void;
    removeListener: () => void;
  };
  _fireMessage: (msg: unknown) => void;
  _fireDisconnect: () => void;
}

function createFakePort(): FakePort {
  const msgListeners: Array<(msg: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  return {
    name: 'tree-view',
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (cb) => {
        msgListeners.push(cb);
      },
      removeListener: () => {},
    },
    onDisconnect: {
      addListener: (cb) => {
        disconnectListeners.push(cb);
      },
      removeListener: () => {},
    },
    _fireMessage(msg) {
      for (const cb of msgListeners) cb(msg);
    },
    _fireDisconnect() {
      for (const cb of disconnectListeners) cb();
    },
  };
}

function createFakeSession(): ActiveSession {
  return {
    viewBridge: new ViewBridge(),
  } as unknown as ActiveSession;
}

beforeEach(() => {
  handleViewMessageMock.mockReset();
});

describe('wireViewPort()', () => {
  it('buffers messages that arrive before session is ready, then drains them in FIFO order', async () => {
    const port = createFakePort();
    const session = createFakeSession();
    let resolve!: (s: ActiveSession | null) => void;
    const ready = new Promise<ActiveSession | null>((r) => {
      resolve = r;
    });

    wireViewPort(port as unknown as Browser.runtime.Port, ready);

    port._fireMessage({
      request: 'request2bkg_get_tree_structure',
    } as ViewToBackgroundMessage);
    port._fireMessage({ __heartbeat: true });

    expect(handleViewMessageMock).not.toHaveBeenCalled();

    resolve(session);
    await ready;

    expect(handleViewMessageMock).toHaveBeenCalledTimes(2);
    expect(handleViewMessageMock.mock.calls[0]).toEqual([
      { request: 'request2bkg_get_tree_structure' },
      port,
      session,
      session.viewBridge,
    ]);
    expect(handleViewMessageMock.mock.calls[1]).toEqual([
      { __heartbeat: true },
      port,
      session,
      session.viewBridge,
    ]);
  });

  it('registers the port with the viewBridge once ready', async () => {
    const port = createFakePort();
    const session = createFakeSession();
    const addPortSpy = vi.spyOn(session.viewBridge, 'addPort');

    wireViewPort(
      port as unknown as Browser.runtime.Port,
      Promise.resolve(session),
    );
    await Promise.resolve();

    expect(addPortSpy).toHaveBeenCalledWith(port);
  });

  it('handles messages synchronously after session is ready', async () => {
    const port = createFakePort();
    const session = createFakeSession();

    wireViewPort(
      port as unknown as Browser.runtime.Port,
      Promise.resolve(session),
    );
    await Promise.resolve();

    port._fireMessage({
      request: 'request2bkg_activateNode',
      targetNodeIdMVC: 1,
    });

    expect(handleViewMessageMock).toHaveBeenCalledTimes(1);
    expect(handleViewMessageMock.mock.calls[0]).toEqual([
      { request: 'request2bkg_activateNode', targetNodeIdMVC: 1 },
      port,
      session,
      session.viewBridge,
    ]);
  });

  it('drops buffered messages silently when session init fails (resolves null)', async () => {
    const port = createFakePort();

    wireViewPort(
      port as unknown as Browser.runtime.Port,
      Promise.resolve(null),
    );

    port._fireMessage({ request: 'request2bkg_get_tree_structure' });
    await Promise.resolve();

    expect(handleViewMessageMock).not.toHaveBeenCalled();
  });

  it('drops buffered messages and skips addPort when port disconnects before session is ready', async () => {
    const port = createFakePort();
    const session = createFakeSession();
    const addPortSpy = vi.spyOn(session.viewBridge, 'addPort');
    let resolve!: (s: ActiveSession | null) => void;
    const ready = new Promise<ActiveSession | null>((r) => {
      resolve = r;
    });

    wireViewPort(port as unknown as Browser.runtime.Port, ready);

    port._fireMessage({ request: 'request2bkg_get_tree_structure' });
    port._fireDisconnect();

    resolve(session);
    await ready;
    await Promise.resolve();

    expect(addPortSpy).not.toHaveBeenCalled();
    expect(handleViewMessageMock).not.toHaveBeenCalled();
  });

  it('ignores new messages after disconnect even on a ready session', async () => {
    const port = createFakePort();
    const session = createFakeSession();

    wireViewPort(
      port as unknown as Browser.runtime.Port,
      Promise.resolve(session),
    );
    await Promise.resolve();

    port._fireDisconnect();
    port._fireMessage({ request: 'request2bkg_get_tree_structure' });

    expect(handleViewMessageMock).not.toHaveBeenCalled();
  });
});
