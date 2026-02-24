/**
 * ActiveSession — the orchestrator that owns the live tree, responds to
 * Chrome events, handles port-based communication with views, and manages
 * persistence.
 *
 * Lifecycle: create() → running → dispose()
 */

import { TreeModel } from '@/tree/tree-model';
import { CloseTracker } from '@/tree/close-tracker';
import { toNodeDTO } from '@/tree/dto';
import { loadTree, saveTree, treeExists } from '@/storage/tree-storage';
import { isMigrationNeeded, migrateFromLegacy } from '@/storage/migration';
import type { Msg_InitTreeView } from '@/types/messages';
import { SaveScheduler } from './save-scheduler';
import { ViewBridge } from './view-bridge';
import { registerChromeEventHandlers } from './chrome-event-handlers';
import { synchronizeTreeWithChrome } from './crash-recovery';
import { updateBadge } from './badge-manager';
import { createAlarm, onAlarm, clearAlarm } from '@/chrome/alarms';

const KEEP_ALIVE_ALARM = 'tabs-outliner-keep-alive';
const KEEP_ALIVE_PERIOD_MINUTES = 25 / 60; // 25 seconds

export class ActiveSession {
  readonly treeModel: TreeModel;
  readonly instanceId: string;
  readonly closeTracker: CloseTracker;
  readonly viewBridge: ViewBridge;

  private readonly _saveScheduler: SaveScheduler;
  private _nextViewId = 0;
  private _cleanupChromeEvents: (() => void) | null = null;
  private _cleanupKeepAlive: (() => void) | null = null;

  private constructor(treeModel: TreeModel) {
    this.treeModel = treeModel;
    this.instanceId = String(Date.now());
    this.closeTracker = new CloseTracker();
    this.viewBridge = new ViewBridge();

    this._saveScheduler = new SaveScheduler(async () => {
      const jso = this.treeModel.toHierarchyJSO();
      await saveTree(jso);
    });
  }

  /** Initialize from persisted storage + Chrome state. */
  static async create(): Promise<ActiveSession> {
    let treeModel: TreeModel;

    // Try loading from new storage first
    const hasTree = await treeExists();
    if (hasTree) {
      const jso = await loadTree();
      if (jso) {
        treeModel = TreeModel.fromHierarchyJSO(jso);
      } else {
        treeModel = TreeModel.createEmpty();
      }
    } else if (await isMigrationNeeded()) {
      // Migrate from legacy IndexedDB (saves to new storage internally)
      const result = await migrateFromLegacy();
      if (result.success && result.nodeCount > 0) {
        const jso = await loadTree();
        if (jso) {
          treeModel = TreeModel.fromHierarchyJSO(jso);
        } else {
          treeModel = TreeModel.createEmpty();
        }
      } else {
        treeModel = TreeModel.createEmpty();
      }
    } else {
      treeModel = TreeModel.createEmpty();
    }

    const session = new ActiveSession(treeModel);

    // Synchronize tree with current Chrome state (crash recovery)
    const recovery = await synchronizeTreeWithChrome(treeModel);
    if (recovery.recoveredCount > 0 || recovery.newCount > 0) {
      console.log(
        `[ActiveSession] Crash recovery: ${recovery.recoveredCount} recovered, ${recovery.newCount} new`,
      );
      // Save the recovered state
      await saveTree(treeModel.toHierarchyJSO());
    }

    // Register Chrome event handlers
    session._cleanupChromeEvents = registerChromeEventHandlers(
      session,
      session.viewBridge,
    );

    // Start keep-alive alarm
    createAlarm(KEEP_ALIVE_ALARM, KEEP_ALIVE_PERIOD_MINUTES);
    session._cleanupKeepAlive = onAlarm(KEEP_ALIVE_ALARM, () => {
      // Keep-alive: just being called keeps the SW alive
    });

    // Initial badge update
    void updateBadge(treeModel);

    return session;
  }

  /** Get the full tree init message for a newly connected view. */
  getInitMessage(): Msg_InitTreeView {
    this._nextViewId++;
    return {
      command: 'msg2view_initTreeView',
      rootNode_currentSession: toNodeDTO(this.treeModel.root),
      globalViewId: this._nextViewId,
      instanceId: this.instanceId,
    };
  }

  /** Schedule a debounced save. */
  scheduleSave(): void {
    this._saveScheduler.schedule();
    void updateBadge(this.treeModel);
  }

  /** Force an immediate save (for onSuspend). */
  async saveNow(): Promise<void> {
    await this._saveScheduler.saveNow();
  }

  /** Shut down: save tree, unregister events, close ports. */
  async dispose(): Promise<void> {
    // Save immediately
    await this.saveNow();

    // Clear keep-alive alarm
    if (this._cleanupKeepAlive) {
      this._cleanupKeepAlive();
      this._cleanupKeepAlive = null;
    }
    await clearAlarm(KEEP_ALIVE_ALARM);

    // Unregister Chrome event handlers
    if (this._cleanupChromeEvents) {
      this._cleanupChromeEvents();
      this._cleanupChromeEvents = null;
    }

    // Close all view ports
    this.viewBridge.disconnectAll();

    // Cancel pending saves
    this._saveScheduler.cancel();
  }
}
