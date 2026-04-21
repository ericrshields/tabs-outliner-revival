/**
 * wireViewPort — attach a freshly-connected view port to the background
 * session, buffering any messages that arrive before session creation
 * completes.
 *
 * Without the buffer, messages arriving while `ActiveSession.create()` is
 * still resolving (common on service-worker wake after system sleep) are
 * silently dropped: the port appears connected to the view but no message
 * listener is attached on the background side, so requests like
 * `request2bkg_get_tree_structure` go into the void.
 */

import type { ActiveSession } from './active-session';
import { handleViewMessage } from './message-handlers';
import type { ViewToBackgroundMessage } from '@/types/messages';

export function wireViewPort(
  port: Browser.runtime.Port,
  sessionReady: Promise<ActiveSession | null>,
): void {
  const buffered: unknown[] = [];
  let activeSession: ActiveSession | null = null;
  let disconnected = false;

  const dispatch = (msg: unknown, session: ActiveSession): void => {
    handleViewMessage(
      msg as ViewToBackgroundMessage,
      port,
      session,
      session.viewBridge,
    );
  };

  port.onDisconnect.addListener(() => {
    disconnected = true;
    buffered.length = 0;
  });

  port.onMessage.addListener((msg: unknown) => {
    if (disconnected) return;
    if (activeSession) {
      dispatch(msg, activeSession);
    } else {
      buffered.push(msg);
    }
  });

  void sessionReady.then((session) => {
    if (!session || disconnected) return;
    session.viewBridge.addPort(port);
    // Drain before exposing activeSession so FIFO order is preserved even if
    // a new message arrives during drain. `shift()` keeps tail pushes in line.
    for (;;) {
      const msg = buffered.shift();
      if (msg === undefined) break;
      dispatch(msg, session);
    }
    activeSession = session;
  });
}
