/**
 * Display adapter — work area bounds for window positioning.
 */

import { browser } from 'wxt/browser';
import { ChromeApiError } from './errors';

export interface WorkArea {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Get the work area of the primary display (excludes taskbar/dock). */
export async function getWorkArea(): Promise<WorkArea> {
  try {
    const displays = await browser.system.display.getInfo();
    if (displays.length === 0) {
      throw new ChromeApiError('No displays found', 'system.display.getInfo');
    }
    const primary = displays.find((d) => d.isPrimary) ?? displays[0];
    const wa = primary.workArea;
    return { top: wa.top, left: wa.left, width: wa.width, height: wa.height };
  } catch (err) {
    if (err instanceof ChromeApiError) throw err;
    throw new ChromeApiError(
      'Failed to get work area',
      'system.display.getInfo',
      err,
    );
  }
}
