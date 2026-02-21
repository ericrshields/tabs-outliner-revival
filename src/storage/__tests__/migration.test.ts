import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { migrateFromLegacy, isMigrationNeeded } from '../migration';
import { DB_V34, DB_V33 } from '../indexeddb-reader';
import { saveTree, loadTree } from '../tree-storage';
import { DbOperationEnum } from '@/types/enums';
import type { LegacyDbConfig } from '../indexeddb-reader';
import type { HierarchyJSO } from '@/types/serialized';

// Helper to populate a fake IndexedDB with operations data
async function populateDB(
  config: LegacyDbConfig,
  data: unknown[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(config.dbName, config.dbVersion);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(config.objectStoreName)) {
        db.createObjectStore(config.objectStoreName, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(config.objectStoreName, 'readwrite');
      tx.objectStore(config.objectStoreName).put({
        key: 'currentSessionSnapshot',
        data,
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteDB(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

function makeValidOps(
  tabs: Array<{ url: string; title: string }> = [],
): unknown[] {
  const ops: unknown[] = [
    {
      type: DbOperationEnum.NODE_NEWROOT,
      node: { type: 'session', data: { treeId: 'test', nextDId: 100 } },
    },
  ];
  for (let i = 0; i < tabs.length; i++) {
    ops.push([DbOperationEnum.NODE_INSERT, { data: tabs[i] }, [i]]);
  }
  ops.push({ type: DbOperationEnum.EOF, time: Date.now() });
  return ops;
}

beforeEach(async () => {
  fakeBrowser.reset();
  await deleteDB(DB_V34.dbName);
  await deleteDB(DB_V33.dbName);
});

describe('isMigrationNeeded', () => {
  it('returns true when no tree in new storage', async () => {
    expect(await isMigrationNeeded()).toBe(true);
  });

  it('returns false when tree exists in new storage', async () => {
    const tree: HierarchyJSO = { n: { type: 'session', data: null } };
    await saveTree(tree);
    expect(await isMigrationNeeded()).toBe(false);
  });
});

describe('migrateFromLegacy', () => {
  it('returns fresh-install when no databases exist', async () => {
    const result = await migrateFromLegacy();
    expect(result.success).toBe(true);
    expect(result.source).toBe('fresh-install');
    expect(result.nodeCount).toBe(0);
  });

  it('skips migration when new storage already has data', async () => {
    const tree: HierarchyJSO = {
      n: { type: 'session', data: { treeId: 'test', nextDId: 0 } },
      s: [{ n: { data: { url: 'a' } } }],
    };
    await saveTree(tree);

    const result = await migrateFromLegacy();
    expect(result.success).toBe(true);
    expect(result.source).toBe('new-storage');
    expect(result.nodeCount).toBe(2);
  });

  it('migrates from V34 IndexedDB', async () => {
    const ops = makeValidOps([
      { url: 'https://a.com', title: 'A' },
      { url: 'https://b.com', title: 'B' },
    ]);
    await populateDB(DB_V34, ops);

    const result = await migrateFromLegacy();
    expect(result.success).toBe(true);
    expect(result.source).toBe('indexeddb-v34');
    expect(result.nodeCount).toBe(3); // session + 2 tabs

    // Verify data is in new storage
    const tree = await loadTree();
    expect(tree).not.toBeNull();
    expect(tree!.s).toHaveLength(2);
  });

  it('falls back to V33 when V34 is invalid', async () => {
    // V34 with invalid data (no EOF)
    await populateDB(DB_V34, [
      { type: DbOperationEnum.NODE_NEWROOT, node: { type: 'session', data: null } },
      // Missing EOF
    ]);

    // V33 with valid data
    const v33Ops = makeValidOps([{ url: 'https://v33.com', title: 'V33' }]);
    await populateDB(DB_V33, v33Ops);

    const result = await migrateFromLegacy();
    expect(result.success).toBe(true);
    expect(result.source).toBe('indexeddb-v33');
  });

  it('handles empty operations (fresh install path)', async () => {
    await populateDB(DB_V34, []);
    const result = await migrateFromLegacy();
    expect(result.success).toBe(true);
    expect(result.source).toBe('fresh-install');
  });

  it('validates round-trip after migration', async () => {
    const ops = makeValidOps([
      { url: 'https://test.com', title: 'Test' },
    ]);
    await populateDB(DB_V34, ops);

    const result = await migrateFromLegacy();
    expect(result.success).toBe(true);

    // The round-trip validation happened internally;
    // verify we can still load the data
    const tree = await loadTree();
    expect(tree).not.toBeNull();
    expect(tree!.n.type).toBe('session');
  });
});
