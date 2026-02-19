import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWorkArea } from '../display';
import { ChromeApiError } from '../errors';

// fakeBrowser doesn't implement system.display — mock it manually
const mockGetInfo = vi.fn();

vi.mock('wxt/browser', () => ({
  browser: {
    system: {
      display: {
        getInfo: (...args: unknown[]) => mockGetInfo(...args),
      },
    },
  },
}));

afterEach(() => {
  mockGetInfo.mockReset();
});

describe('getWorkArea', () => {
  it('returns work area from the primary display', async () => {
    mockGetInfo.mockResolvedValue([
      {
        isPrimary: false,
        workArea: { top: 0, left: 0, width: 1920, height: 1080 },
      },
      {
        isPrimary: true,
        workArea: { top: 50, left: 100, width: 1440, height: 900 },
      },
    ]);

    const result = await getWorkArea();
    expect(result).toEqual({ top: 50, left: 100, width: 1440, height: 900 });
  });

  it('falls back to first display when no primary', async () => {
    mockGetInfo.mockResolvedValue([
      {
        isPrimary: false,
        workArea: { top: 0, left: 0, width: 2560, height: 1440 },
      },
    ]);

    const result = await getWorkArea();
    expect(result).toEqual({ top: 0, left: 0, width: 2560, height: 1440 });
  });

  it('throws ChromeApiError when no displays found', async () => {
    mockGetInfo.mockResolvedValue([]);

    await expect(getWorkArea()).rejects.toBeInstanceOf(ChromeApiError);
    await expect(getWorkArea()).rejects.toThrow('No displays found');
  });

  it('throws ChromeApiError when API fails', async () => {
    mockGetInfo.mockRejectedValue(new Error('permission denied'));

    await expect(getWorkArea()).rejects.toBeInstanceOf(ChromeApiError);
  });
});
