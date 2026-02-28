import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActiveSession } from '../active-session';
import { resetMvcIdCounter } from '@/tree/mvc-id';
import { NodeTypesEnum } from '@/types/enums';

// Mock all external dependencies
vi.mock('@/storage/tree-storage', () => ({
  loadTree: vi.fn().mockResolvedValue(null),
  saveTree: vi.fn().mockResolvedValue(undefined),
  treeExists: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/storage/migration', () => ({
  isMigrationNeeded: vi.fn().mockResolvedValue(false),
  migrateFromLegacy: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/chrome/windows', () => ({
  queryWindows: vi.fn().mockResolvedValue([]),
  onWindowCreated: vi.fn(() => vi.fn()),
  onWindowRemoved: vi.fn(() => vi.fn()),
  onWindowFocusChanged: vi.fn(() => vi.fn()),
}));

vi.mock('@/chrome/tabs', () => ({
  queryTabs: vi.fn().mockResolvedValue([]),
  onTabCreated: vi.fn(() => vi.fn()),
  onTabRemoved: vi.fn(() => vi.fn()),
  onTabUpdated: vi.fn(() => vi.fn()),
  onTabMoved: vi.fn(() => vi.fn()),
  onTabAttached: vi.fn(() => vi.fn()),
  onTabDetached: vi.fn(() => vi.fn()),
  onTabActivated: vi.fn(() => vi.fn()),
  onTabReplaced: vi.fn(() => vi.fn()),
  getTab: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/chrome/alarms', () => ({
  createAlarm: vi.fn(),
  onAlarm: vi.fn(() => vi.fn()),
  clearAlarm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/chrome/action', () => ({
  setBadgeText: vi.fn().mockResolvedValue(undefined),
  setBadgeColor: vi.fn().mockResolvedValue(undefined),
  setTooltip: vi.fn().mockResolvedValue(undefined),
}));

import { treeExists, loadTree, saveTree } from '@/storage/tree-storage';
import { isMigrationNeeded, migrateFromLegacy } from '@/storage/migration';
import { createAlarm, clearAlarm } from '@/chrome/alarms';
import { queryWindows } from '@/chrome/windows';
import { queryTabs } from '@/chrome/tabs';

const mockTreeExists = treeExists as ReturnType<typeof vi.fn>;
const mockLoadTree = loadTree as ReturnType<typeof vi.fn>;
const mockSaveTree = saveTree as ReturnType<typeof vi.fn>;
const mockIsMigrationNeeded = isMigrationNeeded as ReturnType<typeof vi.fn>;
const mockMigrateFromLegacy = migrateFromLegacy as ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetMvcIdCounter();
  vi.clearAllMocks();
  mockTreeExists.mockResolvedValue(false);
  mockLoadTree.mockResolvedValue(null);
  mockIsMigrationNeeded.mockResolvedValue(false);
});

describe('ActiveSession', () => {
  describe('create()', () => {
    it('creates with empty tree when no stored data', async () => {
      const session = await ActiveSession.create();

      expect(session.treeModel).toBeDefined();
      expect(session.treeModel.root).toBeDefined();
      expect(session.instanceId).toBeTruthy();
      expect(session.viewBridge).toBeDefined();
      expect(session.closeTracker).toBeDefined();

      await session.dispose();
    });

    it('loads from storage when tree exists', async () => {
      const jso = {
        n: { type: 'session', data: { treeId: 't1', nextDId: 1, nonDumpedDId: 1 } },
        s: [],
      };
      mockTreeExists.mockResolvedValue(true);
      mockLoadTree.mockResolvedValue(jso);

      const session = await ActiveSession.create();

      expect(session.treeModel.root.type).toBe(NodeTypesEnum.SESSION);
      expect(mockLoadTree).toHaveBeenCalled();

      await session.dispose();
    });

    it('attempts migration when no new storage but legacy data exists', async () => {
      const jso = {
        n: { type: 'session', data: { treeId: 't2', nextDId: 1, nonDumpedDId: 1 } },
        s: [],
      };
      mockTreeExists.mockResolvedValue(false);
      mockIsMigrationNeeded.mockResolvedValue(true);
      mockMigrateFromLegacy.mockResolvedValue({
        success: true,
        source: 'indexeddb-v34',
        nodeCount: 1,
        errors: [],
      });
      // After migration succeeds, loadTree is called to get the data
      mockLoadTree.mockResolvedValue(jso);

      const session = await ActiveSession.create();

      expect(mockMigrateFromLegacy).toHaveBeenCalled();
      expect(mockLoadTree).toHaveBeenCalled();
      expect(session.treeModel.root.type).toBe(NodeTypesEnum.SESSION);

      await session.dispose();
    });

    it('starts keep-alive alarm', async () => {
      const session = await ActiveSession.create();

      expect(createAlarm).toHaveBeenCalledWith(
        'tabs-outliner-keep-alive',
        expect.any(Number),
      );

      await session.dispose();
    });

    it('runs crash recovery', async () => {
      // queryWindows and queryTabs are already mocked to return []
      const session = await ActiveSession.create();

      expect(queryWindows).toHaveBeenCalled();
      expect(queryTabs).toHaveBeenCalled();

      await session.dispose();
    });
  });

  describe('getInitMessage()', () => {
    it('returns init message with tree DTO and incrementing viewId', async () => {
      const session = await ActiveSession.create();

      const msg1 = session.getInitMessage();
      expect(msg1.command).toBe('msg2view_initTreeView');
      expect(msg1.globalViewId).toBe(1);
      expect(msg1.instanceId).toBe(session.instanceId);
      expect(msg1.rootNode_currentSession).toBeDefined();

      const msg2 = session.getInitMessage();
      expect(msg2.globalViewId).toBe(2);

      await session.dispose();
    });
  });

  describe('scheduleSave()', () => {
    it('does not throw', async () => {
      const session = await ActiveSession.create();

      // Should not throw
      session.scheduleSave();

      await session.dispose();
    });
  });

  describe('saveNow()', () => {
    it('calls saveTree with current hierarchy', async () => {
      const session = await ActiveSession.create();
      mockSaveTree.mockClear();

      await session.saveNow();

      expect(mockSaveTree).toHaveBeenCalled();

      await session.dispose();
    });
  });

  describe('importTree()', () => {
    it('imports valid HierarchyJSO and replaces tree model', async () => {
      const session = await ActiveSession.create();
      const jso = {
        n: { type: 'session', data: { treeId: 'imported', nextDId: 1, nonDumpedDId: 1 } },
        s: [
          { n: { type: 'savedwin', data: { id: 1 } }, s: [
            { n: { data: { url: 'https://a.com', title: 'A' } } },
            { n: { data: { url: 'https://b.com', title: 'B' } } },
          ] },
        ],
      };

      const result = await session.importTree(JSON.stringify(jso));

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(4); // session + window + 2 tabs
      expect(mockSaveTree).toHaveBeenCalled();
      // Tree model should have been replaced
      expect(session.treeModel.root.subnodes.length).toBe(1);

      await session.dispose();
    });

    it('imports valid operations log (legacy .tree format)', async () => {
      const session = await ActiveSession.create();
      const ops = [
        { type: 2000, node: { type: 'session', data: { treeId: 'ops', nextDId: 1, nonDumpedDId: 1 } } },
        [2001, { data: { url: 'https://a.com' } }, [0]],
        { type: 11111, time: Date.now() },
      ];

      const result = await session.importTree(JSON.stringify(ops));

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThanOrEqual(2);

      await session.dispose();
    });

    it('returns error for invalid JSON', async () => {
      const session = await ActiveSession.create();

      const result = await session.importTree('not valid json!!!');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.nodeCount).toBe(0);

      await session.dispose();
    });

    it('returns error for unrecognized format', async () => {
      const session = await ActiveSession.create();

      const result = await session.importTree(JSON.stringify({ random: 'object' }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unrecognized format');

      await session.dispose();
    });
  });

  describe('exportTree()', () => {
    it('returns valid JSON string', async () => {
      const session = await ActiveSession.create();

      const result = session.exportTree();

      expect(result.success).toBe(true);
      expect(result.treeJson).toBeTruthy();
      const parsed = JSON.parse(result.treeJson!);
      expect(parsed.n).toBeDefined();

      await session.dispose();
    });
  });

  describe('dispose()', () => {
    it('saves tree, clears alarm, and disconnects ports', async () => {
      const session = await ActiveSession.create();
      mockSaveTree.mockClear();

      await session.dispose();

      expect(mockSaveTree).toHaveBeenCalled();
      expect(clearAlarm).toHaveBeenCalledWith('tabs-outliner-keep-alive');
      expect(session.viewBridge.portCount).toBe(0);
    });

    it('is safe to call multiple times', async () => {
      const session = await ActiveSession.create();

      await session.dispose();
      await session.dispose(); // Should not throw
    });
  });
});
