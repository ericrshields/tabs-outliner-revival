import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveScheduler } from '../save-scheduler';

describe('SaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('schedule()', () => {
    it('calls saveFn after debounce delay', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      expect(saveFn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);
      expect(saveFn).toHaveBeenCalledOnce();
    });

    it('resets debounce timer on subsequent calls', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(80);
      scheduler.schedule(); // Reset timer
      await vi.advanceTimersByTimeAsync(80);

      expect(saveFn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(20);
      expect(saveFn).toHaveBeenCalledOnce();
    });

    it('triggers on max-wait even with continuous resets', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 300);

      // Keep rescheduling every 80ms
      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(80);
      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(80);
      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(80);
      scheduler.schedule();

      // At 240ms, max-wait (300ms) hasn't fired yet
      expect(saveFn).not.toHaveBeenCalled();

      // At 300ms from first schedule, max-wait fires
      await vi.advanceTimersByTimeAsync(60);
      expect(saveFn).toHaveBeenCalledOnce();
    });

    it('does not double-save when debounce and max-wait align', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 100);

      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(100);
      expect(saveFn).toHaveBeenCalledOnce();

      // Advance more to ensure no extra call
      await vi.advanceTimersByTimeAsync(200);
      expect(saveFn).toHaveBeenCalledOnce();
    });

    it('starts a new batch after save completes', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(100);
      expect(saveFn).toHaveBeenCalledOnce();

      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(100);
      expect(saveFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('saveNow()', () => {
    it('executes save immediately', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      await scheduler.saveNow();
      expect(saveFn).toHaveBeenCalledOnce();
    });

    it('cancels pending debounce timer', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      await scheduler.saveNow();
      expect(saveFn).toHaveBeenCalledOnce();

      // Original debounce timer should not fire
      await vi.advanceTimersByTimeAsync(200);
      expect(saveFn).toHaveBeenCalledOnce();
    });

    it('does not re-enter if already saving', async () => {
      let resolveFirst: (() => void) | null = null;
      const saveFn = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      );
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      const first = scheduler.saveNow();
      const second = scheduler.saveNow();

      resolveFirst!();
      await first;
      await second;

      expect(saveFn).toHaveBeenCalledOnce();
    });
  });

  describe('cancel()', () => {
    it('prevents scheduled save from executing', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      scheduler.cancel();

      await vi.advanceTimersByTimeAsync(600);
      expect(saveFn).not.toHaveBeenCalled();
    });
  });

  describe('isPending', () => {
    it('is true when a save is scheduled', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      expect(scheduler.isPending).toBe(false);
      scheduler.schedule();
      expect(scheduler.isPending).toBe(true);
    });

    it('is false after save executes', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(100);
      expect(scheduler.isPending).toBe(false);
    });

    it('is false after cancel', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      scheduler.schedule();
      scheduler.cancel();
      expect(scheduler.isPending).toBe(false);
    });
  });

  describe('isSaving', () => {
    it('is true during save execution', async () => {
      let resolveIt: (() => void) | null = null;
      const saveFn = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveIt = resolve;
          }),
      );
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      expect(scheduler.isSaving).toBe(false);

      const promise = scheduler.saveNow();
      expect(scheduler.isSaving).toBe(true);

      resolveIt!();
      await promise;
      expect(scheduler.isSaving).toBe(false);
    });
  });

  describe('error handling', () => {
    it('resets isSaving after saveFn throws', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('save failed'));
      const scheduler = new SaveScheduler(saveFn, 100, 500);

      await expect(scheduler.saveNow()).rejects.toThrow('save failed');
      expect(scheduler.isSaving).toBe(false);
    });
  });
});
