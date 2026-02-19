/**
 * OAuth2 identity adapter — token lifecycle for Google Drive backup.
 */

import { browser } from 'wxt/browser';
import { ChromeApiError } from './errors';

/**
 * Get an OAuth2 token.
 * Attempts non-interactive first by default; set `interactive: true`
 * to show the consent prompt.
 */
export async function getAuthToken(interactive = false): Promise<string> {
  try {
    const result = await browser.identity.getAuthToken({ interactive });
    // Depending on browser version, result may be the token string
    // or an object with a `token` property.
    if (typeof result === 'string') return result;
    return (result as { token: string }).token;
  } catch (err) {
    throw new ChromeApiError(
      'Failed to get auth token',
      'identity.getAuthToken',
      err,
    );
  }
}

/** Revoke and remove a cached token. */
export async function removeAuthToken(token: string): Promise<void> {
  try {
    await browser.identity.removeCachedAuthToken({ token });
  } catch (err) {
    throw new ChromeApiError(
      'Failed to remove auth token',
      'identity.removeCachedAuthToken',
      err,
    );
  }
}

/** Get the user's email from their Google profile. Returns null if unavailable. */
export async function getProfileEmail(): Promise<string | null> {
  try {
    const info = await browser.identity.getProfileUserInfo({
      accountStatus: 'ANY' as Browser.identity.AccountStatus,
    });
    return info.email || null;
  } catch {
    return null;
  }
}
