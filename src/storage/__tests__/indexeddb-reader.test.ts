import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLegacyDB,
  legacyDbExists,
  DB_V34,
  DB_V33,
} from '../indexeddb-reader';
import type { LegacyDbConfig } from '../indexeddb-reader';
import { DbOperationEnum } from '@/types/enums';

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
      const store = tx.objectStore(config.objectStoreName);
      store.put({ key: 'currentSessionSnapshot', data });
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

// Helper to delete a database
async function deleteDB(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

beforeEach(async () => {
  await deleteDB(DB_V34.dbName);
  await deleteDB(DB_V33.dbName);
});

describe('readLegacyDB', () => {
  it('reads operations data from V34 database', async () => {
    const operations = [
      { type: DbOperationEnum.NODE_NEWROOT, node: { type: 'session', data: null } },
      { type: DbOperationEnum.EOF, time: 12345 },
    ];

    await populateDB(DB_V34, operations);
    const result = await readLegacyDB(DB_V34);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect((result![0] as Record<string, unknown>).type).toBe(DbOperationEnum.NODE_NEWROOT);
  });

  it('returns null for empty database', async () => {
    const result = await readLegacyDB(DB_V34);
    expect(result).toBeNull();
  });

  it('reads V33 database', async () => {
    const operations = [
      { type: DbOperationEnum.NODE_NEWROOT, node: { type: 'session', data: null } },
      { type: DbOperationEnum.EOF, time: 99999 },
    ];

    await populateDB(DB_V33, operations);
    const result = await readLegacyDB(DB_V33);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it('returns the data array, not the record wrapper', async () => {
    const operations = [{ type: 1 }, { type: 2 }];
    await populateDB(DB_V34, operations);
    const result = await readLegacyDB(DB_V34);

    // Should NOT contain {key, data} wrapper — just the inner array
    expect(result).toEqual(operations);
    expect((result as unknown as Record<string, unknown>).key).toBeUndefined();
  });

  it('handles mixed object/array operation formats', async () => {
    const operations = [
      { type: DbOperationEnum.NODE_NEWROOT, node: { type: 'session', data: null } },
      [DbOperationEnum.NODE_INSERT, { data: { url: 'test' } }, [0]],
      { type: DbOperationEnum.EOF, time: 12345 },
    ];

    await populateDB(DB_V34, operations);
    const result = await readLegacyDB(DB_V34);

    expect(result).toHaveLength(3);
    expect(Array.isArray(result![1])).toBe(true);
  });
});

describe('legacyDbExists', () => {
  it('returns true when database has data', async () => {
    await populateDB(DB_V34, [{ type: 1 }]);
    const exists = await legacyDbExists(DB_V34);
    expect(exists).toBe(true);
  });

  it('returns false when database has no data', async () => {
    const exists = await legacyDbExists(DB_V34);
    expect(exists).toBe(false);
  });
});
