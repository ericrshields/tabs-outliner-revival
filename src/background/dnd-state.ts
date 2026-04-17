/**
 * Shared DnD state between message-handlers and chrome-event-handlers.
 *
 * Tab IDs currently being moved by DnD to a new Chrome window.
 * Checked by handleTabAttached to suppress duplicate tree moves
 * while chrome.windows.create({tabId}) events are in flight.
 */
export const dndPendingTabIds = new Set<number>();
