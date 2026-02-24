/**
 * WXT background entrypoint — service worker for Tabs Outliner Revival.
 *
 * Creates the ActiveSession on startup and wires lifecycle hooks,
 * port connections, action clicks, and keyboard commands.
 */

import { ActiveSession } from '@/background/active-session';
import { handleViewMessage } from '@/background/message-handlers';
import { onPortConnect } from '@/chrome/runtime';
import { onActionClicked } from '@/chrome/action';
import { onCommand } from '@/chrome/commands';
import {
  onExtensionInstalled,
  onExtensionStartup,
  onServiceWorkerSuspend,
} from '@/chrome/lifecycle';
import { createTab, queryTabs, removeTab, focusTab } from '@/chrome/tabs';
import { queryWindows, removeWindow } from '@/chrome/windows';

export default defineBackground(() => {
  console.log('Tabs Outliner Revival: background service worker started', {
    id: browser.runtime.id,
  });

  let session: ActiveSession | null = null;
  let initPromise: Promise<void> | null = null;

  async function initSession(): Promise<void> {
    if (session || initPromise) return;
    initPromise = (async () => {
      try {
        session = await ActiveSession.create();
        console.log('[background] ActiveSession created', {
          instanceId: session.instanceId,
        });
      } catch (err) {
        console.error('[background] Failed to create ActiveSession:', err);
      } finally {
        initPromise = null;
      }
    })();
    await initPromise;
  }

  // Initialize session on startup and install
  onExtensionStartup(() => {
    void initSession();
  });

  onExtensionInstalled(() => {
    void initSession();
  });

  // Immediate init for when the SW first loads
  void initSession();

  // Save tree on suspend (best-effort — Chrome may kill the SW before completion)
  onServiceWorkerSuspend(() => {
    if (session) {
      void session.saveNow();
    }
  });

  // Wire view port connections
  onPortConnect('tree-view', (port) => {
    if (!session) return;

    session.viewBridge.addPort(port);

    port.onMessage.addListener((msg: unknown) => {
      if (!session) return;
      handleViewMessage(
        msg as import('@/types/messages').ViewToBackgroundMessage,
        port,
        session,
        session.viewBridge,
      );
    });
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
