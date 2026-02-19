import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAuthToken, removeAuthToken, getProfileEmail } from '../identity';
import { ChromeApiError } from '../errors';

// fakeBrowser doesn't implement identity APIs — mock manually
const mockGetAuthToken = vi.fn();
const mockRemoveCachedAuthToken = vi.fn();
const mockGetProfileUserInfo = vi.fn();

vi.mock('wxt/browser', () => ({
  browser: {
    identity: {
      getAuthToken: (...args: unknown[]) => mockGetAuthToken(...args),
      removeCachedAuthToken: (...args: unknown[]) => mockRemoveCachedAuthToken(...args),
      getProfileUserInfo: (...args: unknown[]) => mockGetProfileUserInfo(...args),
    },
  },
}));

afterEach(() => {
  mockGetAuthToken.mockReset();
  mockRemoveCachedAuthToken.mockReset();
  mockGetProfileUserInfo.mockReset();
});

describe('getAuthToken', () => {
  it('returns token when result is a string', async () => {
    mockGetAuthToken.mockResolvedValue('abc123');
    const token = await getAuthToken();
    expect(token).toBe('abc123');
    expect(mockGetAuthToken).toHaveBeenCalledWith({ interactive: false });
  });

  it('returns token when result is an object with token property', async () => {
    mockGetAuthToken.mockResolvedValue({ token: 'xyz789' });
    const token = await getAuthToken();
    expect(token).toBe('xyz789');
  });

  it('passes interactive flag', async () => {
    mockGetAuthToken.mockResolvedValue('tok');
    await getAuthToken(true);
    expect(mockGetAuthToken).toHaveBeenCalledWith({ interactive: true });
  });

  it('throws ChromeApiError on failure', async () => {
    mockGetAuthToken.mockRejectedValue(new Error('not signed in'));
    await expect(getAuthToken()).rejects.toBeInstanceOf(ChromeApiError);
  });
});

describe('removeAuthToken', () => {
  it('removes the cached token', async () => {
    mockRemoveCachedAuthToken.mockResolvedValue(undefined);
    await removeAuthToken('old-token');
    expect(mockRemoveCachedAuthToken).toHaveBeenCalledWith({ token: 'old-token' });
  });

  it('throws ChromeApiError on failure', async () => {
    mockRemoveCachedAuthToken.mockRejectedValue(new Error('fail'));
    await expect(removeAuthToken('x')).rejects.toBeInstanceOf(ChromeApiError);
  });
});

describe('getProfileEmail', () => {
  it('returns email when available', async () => {
    mockGetProfileUserInfo.mockResolvedValue({ email: 'user@example.com' });
    const email = await getProfileEmail();
    expect(email).toBe('user@example.com');
  });

  it('returns null when email is empty string', async () => {
    mockGetProfileUserInfo.mockResolvedValue({ email: '' });
    const email = await getProfileEmail();
    expect(email).toBeNull();
  });

  it('returns null on error', async () => {
    mockGetProfileUserInfo.mockRejectedValue(new Error('unauthorized'));
    const email = await getProfileEmail();
    expect(email).toBeNull();
  });
});
