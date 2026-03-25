import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useChromeStorage } from '../use-chrome-storage';

vi.mock('@/chrome/storage', () => ({
  storageGet: vi.fn(),
  storageSet: vi.fn(),
  onStorageChanged: vi.fn(() => vi.fn()), // returns cleanup fn
}));

import { storageGet, storageSet, onStorageChanged } from '@/chrome/storage';

const mockStorageGet = vi.mocked(storageGet);
const mockStorageSet = vi.mocked(storageSet);
const mockOnStorageChanged = vi.mocked(onStorageChanged);

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageGet.mockResolvedValue(undefined as unknown as never);
  mockOnStorageChanged.mockReturnValue(vi.fn());
});

describe('useChromeStorage', () => {
  it('returns the default value before storage loads', () => {
    mockStorageGet.mockResolvedValue(undefined as unknown as never);
    const { result } = renderHook(() =>
      useChromeStorage('local', 'myKey', false),
    );
    // Before async load resolves, value is the default
    expect(result.current[0]).toBe(false);
  });

  it('loads and returns the stored value', async () => {
    mockStorageGet.mockResolvedValue(true as never);
    const { result } = renderHook(() =>
      useChromeStorage('local', 'myKey', false),
    );

    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
    expect(mockStorageGet).toHaveBeenCalledWith('local', 'myKey', false);
  });

  it('falls back to default when stored value is undefined', async () => {
    mockStorageGet.mockResolvedValue(false as never); // storageGet returns the fallback itself
    const { result } = renderHook(() =>
      useChromeStorage('local', 'myKey', false),
    );

    await waitFor(() => expect(result.current[0]).toBe(false));
  });

  it('updates storage when setter is called', async () => {
    mockStorageGet.mockResolvedValue(false as never);
    mockStorageSet.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useChromeStorage('local', 'myKey', false),
    );

    // Flush the initial storageGet load before calling the setter
    await act(async () => {});

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(mockStorageSet).toHaveBeenCalledWith('local', { myKey: true });
  });

  it('optimistically updates state before storage write resolves', async () => {
    mockStorageGet.mockResolvedValue(false as never);
    let resolveSet!: () => void;
    mockStorageSet.mockReturnValue(
      new Promise<void>((res) => {
        resolveSet = res;
      }),
    );

    const { result } = renderHook(() =>
      useChromeStorage('local', 'counter', 0),
    );

    act(() => {
      result.current[1](42);
    });

    // State updates immediately even before storageSet resolves
    expect(result.current[0]).toBe(42);
    resolveSet();
  });

  it('subscribes to onStorageChanged on mount', () => {
    renderHook(() => useChromeStorage('local', 'myKey', false));
    expect(mockOnStorageChanged).toHaveBeenCalledWith(
      'local',
      'myKey',
      expect.any(Function),
    );
  });

  it('calls cleanup from onStorageChanged on unmount', () => {
    const cleanup = vi.fn();
    mockOnStorageChanged.mockReturnValue(cleanup);

    const { unmount } = renderHook(() =>
      useChromeStorage('local', 'myKey', false),
    );
    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('updates state when storage change is observed', async () => {
    mockStorageGet.mockResolvedValue('initial' as never);
    let storedListener!: (newValue: unknown) => void;
    mockOnStorageChanged.mockImplementation(
      (_area, _key, cb: (newValue: unknown, oldValue: unknown) => void) => {
        storedListener = (newValue: unknown) => cb(newValue, undefined);
        return vi.fn();
      },
    );

    const { result } = renderHook(() => useChromeStorage('local', 'myKey', ''));

    await waitFor(() => expect(result.current[0]).toBe('initial'));

    act(() => {
      storedListener('updated');
    });

    expect(result.current[0]).toBe('updated');
  });
});
