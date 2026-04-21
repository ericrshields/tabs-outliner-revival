/**
 * WXT background entrypoint — service worker for Tabs Outliner Revival.
 *
 * Creates the ActiveSession on startup and wires lifecycle hooks,
 * port connections, action clicks, and keyboard commands.
 */

import { ActiveSession } from '@/background/active-session';
import { wireViewPort } from '@/background/view-port-setup';
import { onPortConnect } from '@/chrome/runtime';
import { onActionClicked } from '@/chrome/action';
import { onCommand } from '@/chrome/commands';
import {
  onExtensionInstalled,
  onExtensionStartup,
  onServiceWorkerSuspend,
} from '@/chrome/lifecycle';
import { onStorageChanged } from '@/chrome/storage';
import { createTab, queryTabs, removeTab, focusTab } from '@/chrome/tabs';
import { queryWindows, removeWindow } from '@/chrome/windows';
import {
  getDedicationSeenFlag,
  setDedicationSeenFlag,
} from '@/storage/settings-storage';
import { SETTINGS_KEY } from '@/types/settings';

export default defineBackground(() => {
  console.log('Tabs Outliner Revival: background service worker started', {
    id: browser.runtime.id,
  });

  let session: ActiveSession | null = null;
  let initPromise: Promise<ActiveSession | null> | null = null;

  async function initSession(): Promise<ActiveSession | null> {
    if (session) return session;
    if (!initPromise) {
      initPromise = (async () => {
        try {
          session = await ActiveSession.create();
          console.log('[background] ActiveSession created', {
            instanceId: session.instanceId,
          });

          // Broadcast settings changes to all connected views.
          // Cleanup intentionally discarded — SW has no unmount lifecycle.
          onStorageChanged('local', SETTINGS_KEY, () => {
            if (session) {
              session.viewBridge.broadcast({
                command: 'msg2view_optionsChanged_message',
                changedOption: SETTINGS_KEY,
              });
            }
          });
          return session;
        } catch (err) {
          console.error('[background] Failed to create ActiveSession:', err);
          // Clear initPromise only on failure so callers can retry.
          initPromise = null;
          return null;
        }
      })();
    }
    return initPromise;
  }

  // Initialize session on startup and install
  onExtensionStartup(() => {
    void initSession();
  });

  onExtensionInstalled(async (details) => {
    await initSession();
    // Open the dedication page only on first install (not on updates).
    if (details.reason !== 'install') return;
    const seen = await getDedicationSeenFlag();
    if (!seen) {
      await createTab({
        url: browser.runtime.getURL(
          '/dedication.html' as Parameters<typeof browser.runtime.getURL>[0],
        ),
      });
      await setDedicationSeenFlag();
    }
  });

  // Immediate init for when the SW first loads
  void initSession();

  // Save tree on suspend (best-effort — Chrome may kill the SW before completion)
  onServiceWorkerSuspend(() => {
    if (session) {
      void session.saveNow();
    }
  });

  // Wire view port connections. Always attach the message listener
  // synchronously so requests arriving before session init resolves (e.g.,
  // on SW wake after system sleep) are buffered instead of dropped.
  onPortConnect('tree-view', (port) => {
    wireViewPort(port, initSession());
  });

  // Browser action click — create or focus the tree tab
  onActionClicked(async () => {
    const treeUrl = browser.runtime.getURL('/tree.html');

    // Check if tree tab already exists
    const existing = await queryTabs({ url: treeUrl });
    if (existing.length > 0 && existing[0].id != null) {
      await focusTab(existing[0].id, existing[0].windowId ?? 0);
    } else {
      await createTab({ url: treeUrl });
    }
  });

  // Keyboard command handlers
  onCommand(async (command) => {
    if (!session) return;

    switch (command) {
      case 'save_close_current_tab': {
        const [activeTab] = await queryTabs({
          active: true,
          currentWindow: true,
        });
        if (activeTab?.id != null) {
          await removeTab(activeTab.id);
        }
        break;
      }

      case 'save_close_current_window': {
        const wins = await queryWindows();
        const focused = wins.find((w) => w.focused);
        if (focused?.id != null) {
          await removeWindow(focused.id);
        }
        break;
      }

      case 'save_close_all_windows': {
        const wins = await queryWindows();
        for (const win of wins) {
          if (win.id != null) {
            await removeWindow(win.id);
          }
        }
        break;
      }

      default:
        console.warn(`[background] Unknown command: ${command}`);
        break;
    }
  });
});
