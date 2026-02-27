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
import {
  isValidHierarchyJSO,
  countNodes,
  exportTreeFile,
} from '@/serialization/hierarchy-jso';
import {
  validateOperationsLog,
  operationsToHierarchy,
} from '@/serialization/operations-codec';
import type { HierarchyJSO } from '@/types/serialized';
import type { SerializedNode } from '@/types/serialized';
import type { Msg_InitTreeView } from '@/types/messages';
import { SaveScheduler } from './save-scheduler';
import { ViewBridge } from './view-bridge';
import { registerChromeEventHandlers } from './chrome-event-handlers';
import { synchronizeTreeWithChrome } from './crash-recovery';
import { updateBadge } from './badge-manager';
import { createAlarm, onAlarm, clearAlarm } from '@/chrome/alarms';

const KEEP_ALIVE_ALARM = 'tabs-outliner-keep-alive';
/** Chrome alarms API requires minutes; 25 seconds keeps SW alive under 30s timeout. */
const KEEP_ALIVE_INTERVAL_SECONDS = 25;
const KEEP_ALIVE_PERIOD_MINUTES = KEEP_ALIVE_INTERVAL_SECONDS / 60;

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

  /** Import a tree from JSON (HierarchyJSO or legacy operations log). */
  async importTree(
    treeJson: string,
  ): Promise<{ success: boolean; nodeCount: number; error?: string }> {
    try {
      const parsed: unknown = JSON.parse(treeJson);

      let hierarchy: HierarchyJSO;
      if (isValidHierarchyJSO(parsed)) {
        hierarchy = parsed;
      } else if (Array.isArray(parsed)) {
        const validation = validateOperationsLog(parsed);
        if (!validation.valid) {
          return { success: false, nodeCount: 0, error: validation.reason };
        }
        const converted = operationsToHierarchy(parsed);
        if (!converted) {
          return {
            success: false,
            nodeCount: 0,
            error: 'Failed to convert operations log to tree',
          };
        }
        hierarchy = converted;
      } else {
        return {
          success: false,
          nodeCount: 0,
          error: 'Unrecognized format: expected HierarchyJSO or operations log array',
        };
      }

      // Convert all active node types to saved equivalents before
      // creating the tree. More reliable than crash recovery's ID matching,
      // which misses tabs whose IDs collide with currently-open Chrome tabs.
      const deactivated = deactivateHierarchy(hierarchy);
      console.log(`[importTree] Deactivated ${deactivated} active nodes`);

      await saveTree(hierarchy);
      this.treeModel.replaceWith(TreeModel.fromHierarchyJSO(hierarchy));

      // Convert orphaned active nodes → saved (imported tabs/windows
      // won't match any current Chrome entities)
      const recovery = await synchronizeTreeWithChrome(this.treeModel);
      console.log(
        `[importTree] Crash recovery: ${recovery.recoveredCount} recovered, ${recovery.newCount} new`,
      );
      await saveTree(this.treeModel.toHierarchyJSO());

      return { success: true, nodeCount: countNodes(hierarchy) };
    } catch (err) {
      return {
        success: false,
        nodeCount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Export the current tree as a JSON string. */
  exportTree(): { success: boolean; treeJson?: string; error?: string } {
    try {
      const hierarchy = this.treeModel.toHierarchyJSO();
      return { success: true, treeJson: exportTreeFile(hierarchy) };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
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

// -- Import helpers --

/** Map active node types to their saved equivalents. */
const ACTIVE_TO_SAVED: Record<string, string | undefined> = {
  tab: undefined,       // absent type = savedtab
  win: 'savedwin',
  waitingtab: undefined,
  attachwaitingtab: undefined,
  waitingwin: 'savedwin',
};

/**
 * Walk a HierarchyJSO tree and convert all active node types to saved.
 * Mutates in place. Removes Chrome runtime IDs (tab id, window id)
 * since they're meaningless after import.
 */
function deactivateHierarchy(hierarchy: HierarchyJSO): number {
  let count = 0;
  const node = hierarchy.n as unknown as Record<string, unknown>;
  const type = node.type as string | undefined;

  if (type && type in ACTIVE_TO_SAVED) {
    const savedType = ACTIVE_TO_SAVED[type];
    if (savedType === undefined) {
      delete node.type; // absent = savedtab
    } else {
      node.type = savedType;
    }
    count++;

    // Clear Chrome runtime IDs — meaningless after import
    const data = node.data as Record<string, unknown> | undefined;
    if (data) {
      delete data.id;
      delete data.windowId;
      data.active = false;
    }
  }

  if (hierarchy.s) {
    for (const child of hierarchy.s) {
      count += deactivateHierarchy(child);
    }
  }
  return count;
}
