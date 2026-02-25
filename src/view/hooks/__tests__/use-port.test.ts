import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import type { PortState } from '@/chrome/runtime';

// Mock PortManager at module level
const mockConnect = vi.fn();
const mockDispose = vi.fn();
const mockPostMessage = vi.fn();
const mockOnMessage = vi.fn<(cb: (msg: unknown) => void) => () => void>();
const mockOnStateChange = vi.fn<(cb: (state: PortState) => void) => () => void>();

vi.mock('@/chrome/runtime', () => ({
  PortManager: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    dispose: mockDispose,
    postMessage: mockPostMessage,
    onMessage: mockOnMessage,
    onStateChange: mockOnStateChange,
    state: 'disconnected',
  })),
}));

// Import after mock
import { usePort } from '../use-port';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: capture callbacks but don't call them
  mockOnMessage.mockReturnValue(vi.fn());
  mockOnStateChange.mockReturnValue(vi.fn());
});

/** Simulate the PortManager calling its state change callback. */
function triggerStateChange(state: PortState): void {
  const stateCallback = mockOnStateChange.mock.calls[0]?.[0];
  if (stateCallback) {
    act(() => stateCallback(state));
  }
}

/** Simulate the PortManager calling its message callback. */
function triggerMessage(msg: unknown): void {
  const msgCallback = mockOnMessage.mock.calls[0]?.[0];
  if (msgCallback) {
    act(() => msgCallback(msg));
  }
}

describe('usePort', () => {
  it('creates a PortManager and connects on mount', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    renderHook(() => usePort(onMessage, onReconnect));

    expect(mockOnMessage).toHaveBeenCalledTimes(1);
    expect(mockOnStateChange).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('disposes the PortManager on unmount', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    const { unmount } = renderHook(() => usePort(onMessage, onReconnect));
    unmount();

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('starts with disconnected state', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    const { result } = renderHook(() => usePort(onMessage, onReconnect));

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });

  it('updates connectionState when PortManager state changes', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    const { result } = renderHook(() => usePort(onMessage, onReconnect));

    triggerStateChange('connecting');
    expect(result.current.connectionState).toBe('connecting');
    expect(result.current.isConnected).toBe(false);

    triggerStateChange('connected');
    expect(result.current.connectionState).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('forwards messages to onMessage callback', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    renderHook(() => usePort(onMessage, onReconnect));

    const testMsg = { command: 'msg2view_initTreeView' };
    triggerMessage(testMsg);

    expect(onMessage).toHaveBeenCalledWith(testMsg);
  });

  it('does NOT call onReconnect on first connection', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    renderHook(() => usePort(onMessage, onReconnect));

    triggerStateChange('connected');

    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('calls onReconnect on subsequent connections', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    renderHook(() => usePort(onMessage, onReconnect));

    // First connect
    triggerStateChange('connected');
    expect(onReconnect).not.toHaveBeenCalled();

    // Disconnect
    triggerStateChange('connecting');

    // Reconnect
    triggerStateChange('connected');
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('postMessage delegates to PortManager', () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    const { result } = renderHook(() => usePort(onMessage, onReconnect));

    const msg = { request: 'request2bkg_get_tree_structure' as const };
    result.current.postMessage(msg);

    expect(mockPostMessage).toHaveBeenCalledWith(msg);
  });

  it('uses latest onMessage callback via ref (no re-subscribe)', () => {
    const onMessage1 = vi.fn();
    const onMessage2 = vi.fn();
    const onReconnect = vi.fn();

    const { rerender } = renderHook(
      ({ onMsg }) => usePort(onMsg, onReconnect),
      { initialProps: { onMsg: onMessage1 } },
    );

    // Rerender with new callback
    rerender({ onMsg: onMessage2 });

    // PortManager should only have been subscribed once
    expect(mockOnMessage).toHaveBeenCalledTimes(1);

    // But new callback should be used
    const testMsg = { command: 'msg2view_setCursorHere' };
    triggerMessage(testMsg);

    expect(onMessage1).not.toHaveBeenCalled();
    expect(onMessage2).toHaveBeenCalledWith(testMsg);
  });

  it('uses latest onReconnect callback via ref', () => {
    const onMessage = vi.fn();
    const onReconnect1 = vi.fn();
    const onReconnect2 = vi.fn();

    const { rerender } = renderHook(
      ({ onRecon }) => usePort(onMessage, onRecon),
      { initialProps: { onRecon: onReconnect1 } },
    );

    // First connect
    triggerStateChange('connected');

    // Update callback
    rerender({ onRecon: onReconnect2 });

    // Reconnect
    triggerStateChange('connecting');
    triggerStateChange('connected');

    expect(onReconnect1).not.toHaveBeenCalled();
    expect(onReconnect2).toHaveBeenCalledTimes(1);
  });
});
