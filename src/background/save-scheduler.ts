/**
 * SaveScheduler — debounced persistence scheduler.
 *
 * Batches rapid tree mutations into a single save operation using
 * debounce (3s default) with a max-wait ceiling (8s default) to
 * guarantee writes during sustained activity. `saveNow()` is used
 * by `onSuspend` for immediate persistence before SW termination.
 */

export class SaveScheduler {
  private readonly _saveFn: () => Promise<void>;
  private readonly _delayMs: number;
  private readonly _maxWaitMs: number;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private _saving = false;

  constructor(
    saveFn: () => Promise<void>,
    delayMs: number = 3_000,
    maxWaitMs: number = 8_000,
  ) {
    this._saveFn = saveFn;
    this._delayMs = delayMs;
    this._maxWaitMs = maxWaitMs;
  }

  /** Schedule a save (debounced). Resets the debounce timer on each call. */
  schedule(): void {
    // Reset debounce timer
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      void this._executeSave();
    }, this._delayMs);

    // Start max-wait timer on first schedule call in this batch
    if (this._maxWaitTimer === null) {
      this._maxWaitTimer = setTimeout(() => {
        this._maxWaitTimer = null;
        // Cancel pending debounce — max-wait takes over
        if (this._debounceTimer !== null) {
          clearTimeout(this._debounceTimer);
          this._debounceTimer = null;
        }
        void this._executeSave();
      }, this._maxWaitMs);
    }
  }

  /** Force an immediate save, cancelling any pending timers. */
  async saveNow(): Promise<void> {
    this._clearTimers();
    await this._executeSave();
  }

  /** Cancel all pending saves without executing. */
  cancel(): void {
    this._clearTimers();
  }

  /** Whether a save is currently in progress. */
  get isSaving(): boolean {
    return this._saving;
  }

  /** Whether a save is scheduled (debounce or max-wait timer active). */
  get isPending(): boolean {
    return this._debounceTimer !== null || this._maxWaitTimer !== null;
  }

  private async _executeSave(): Promise<void> {
    if (this._saving) return;
    this._saving = true;
    this._clearTimers();
    try {
      await this._saveFn();
    } finally {
      this._saving = false;
    }
  }

  private _clearTimers(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._maxWaitTimer !== null) {
      clearTimeout(this._maxWaitTimer);
      this._maxWaitTimer = null;
    }
  }
}
