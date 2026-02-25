import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import type { PortState } from '@/chrome/runtime';

// Capture hook callbacks for driving the test
let capturedOnMessage: ((msg: unknown) => void) | null = null;
let capturedOnReconnect: (() => void) | null = null;
let mockConnectionState: PortState = 'connected';

const mockPostMessage = vi.fn();

// Mock the view module hooks
vi.mock('@/view/index', async () => {
  const actual = await vi.importActual('@/view/index');
  return {
    ...actual,
    usePort: (
      onMessage: (msg: unknown) => void,
      onReconnect: () => void,
    ) => {
      capturedOnMessage = onMessage;
      capturedOnReconnect = onReconnect;
      return {
        postMessage: mockPostMessage,
        connectionState: mockConnectionState,
        isConnected: mockConnectionState === 'connected',
      };
    },
  };
});

import { App } from './App';
import { makeTree } from '@/view/__tests__/fixtures';
import type { Msg_InitTreeView } from '@/types/messages';
import { act } from '@testing-library/preact';

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnMessage = null;
  capturedOnReconnect = null;
  mockConnectionState = 'connected';
});

describe('Tree App', () => {
  it('shows loading state initially', () => {
    render(<App />);
    expect(screen.getByText('Loading tree...')).toBeTruthy();
  });

  it('requests tree on mount', () => {
    render(<App />);
    expect(mockPostMessage).toHaveBeenCalledWith({
      request: 'request2bkg_get_tree_structure',
    });
  });

  it('transitions from loading to tree after init message', () => {
    render(<App />);
    expect(screen.getByText('Loading tree...')).toBeTruthy();

    const initMsg: Msg_InitTreeView = {
      command: 'msg2view_initTreeView',
      rootNode_currentSession: makeTree(),
      globalViewId: 1,
      instanceId: 'test',
    };

    act(() => capturedOnMessage!(initMsg));

    // Loading indicator should be gone — tree is now rendered
    // (react-arborist's virtualized output doesn't render text in happy-dom,
    // so we verify the loading state was removed)
    expect(screen.queryByText('Loading tree...')).toBeNull();
  });

  it('re-requests tree on reconnect', () => {
    render(<App />);
    mockPostMessage.mockClear();

    act(() => capturedOnReconnect!());

    expect(mockPostMessage).toHaveBeenCalledWith({
      request: 'request2bkg_get_tree_structure',
    });
  });

  it('shows connection banner when disconnected', () => {
    mockConnectionState = 'connecting';
    render(<App />);
    expect(
      screen.getByText('Reconnecting to background...'),
    ).toBeTruthy();
  });
});
