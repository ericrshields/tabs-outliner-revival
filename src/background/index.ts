/**
 * Background module barrel export.
 */

export { ActiveSession } from './active-session';
export { ViewBridge } from './view-bridge';
export { SaveScheduler } from './save-scheduler';
export { synchronizeTreeWithChrome } from './crash-recovery';
export type { RecoveryResult } from './crash-recovery';
export { updateBadge } from './badge-manager';
export { registerChromeEventHandlers } from './chrome-event-handlers';
export { handleViewMessage } from './message-handlers';
