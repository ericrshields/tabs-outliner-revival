import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChromeApiError, withRetry } from '../errors';

describe('ChromeApiError', () => {
  it('stores the API method name', () => {
    const err = new ChromeApiError('boom', 'tabs.query');
    expect(err.message).toBe('boom');
    expect(err.apiMethod).toBe('tabs.query');
    expect(err.name).toBe('ChromeApiError');
    expect(err.cause).toBeUndefined();
  });

  it('chains cause through the standard Error options bag', () => {
    const cause = new Error('network');
    const err = new ChromeApiError('fail', 'storage.get', cause);
    expect(err.cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    const err = new ChromeApiError('x', 'y');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { baseDelayMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });

    // Attach a no-op catch immediately to prevent unhandled rejection warnings.
    // The actual rejection assertion is below via expect().rejects.
    promise.catch(() => {});

    // Advance past both retry delays (1ms + 2ms)
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(2);

    await expect(promise).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops early when shouldRetry returns false', async () => {
    const error = new Error('no retry');
    const fn = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 1, shouldRetry }),
    ).rejects.toThrow('no retry');
    expect(fn).toHaveBeenCalledTimes(1);
    // Verify shouldRetry receives the actual error
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('applies exponential backoff between retries', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });

    // First retry: 100ms delay (100 * 2^0)
    await vi.advanceTimersByTimeAsync(100);
    // Second retry: 200ms delay (100 * 2^1)
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('clamps maxAttempts to at least 1', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clamps negative maxAttempts to 1', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, { maxAttempts: -5, baseDelayMs: 1 })).rejects.toThrow(
      'fail',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
