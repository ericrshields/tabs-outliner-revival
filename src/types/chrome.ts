/**
 * Serialized subsets of Chrome tab and window data.
 *
 * These represent the shape of data persisted to IndexedDB, which is a
 * subset of the full chrome.tabs.Tab / chrome.windows.Window APIs.
 */

export type ChromeWindowType = 'normal' | 'popup' | 'panel' | 'app' | 'devtools';

export interface ChromeTabData {
  readonly id?: number;
  readonly windowId?: number;
  readonly url?: string;
  readonly title?: string;
  readonly favIconUrl?: string;
  readonly status?: string;
  readonly pinned?: boolean;
  readonly incognito?: boolean;
  readonly active?: boolean;
  readonly highlighted?: boolean;
}

export interface ChromeWindowData {
  readonly id?: number;
  readonly type?: ChromeWindowType;
  readonly incognito?: boolean;
  readonly alwaysOnTop?: boolean;
  readonly focused?: boolean;
  readonly rect?: {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
  };
  readonly closeDate?: number;
  readonly crashDetectedDate?: number;
}
