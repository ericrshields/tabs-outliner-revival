/**
 * Read-only access to legacy Tabs Outliner IndexedDB databases.
 *
 * Supports both V34 (TabsOutlinerDB34) and V33 (TabsOutlinerDB2) formats.
 * The data is an operations log array stored under key "currentSessionSnapshot".
 */

export interface LegacyDbConfig {
  readonly dbName: string;
  readonly dbVersion: number;
  readonly objectStoreName: string;
}

export const DB_V34: LegacyDbConfig = {
  dbName: 'TabsOutlinerDB34',
  dbVersion: 34,
  objectStoreName: 'current_session_snapshot',
};

export const DB_V33: LegacyDbConfig = {
  dbName: 'TabsOutlinerDB2',
  dbVersion: 33,
  objectStoreName: 'current_session_snapshot',
};

/**
 * Read-only access to legacy IndexedDB. Returns the operations array
 * (record.data), or null if not found.
 *
 * The raw IndexedDB record is {key: string, data: unknown[]} — this
 * function strips the wrapper and returns only the inner data array.
 *
 * Follows the legacy safe open pattern from background.js:1082 —
 * registers onupgradeneeded to create the store only if none exist.
 */
export async function readLegacyDB(
  config: LegacyDbConfig,
): Promise<unknown[] | null> {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(config.dbName, config.dbVersion);

    openRequest.onupgradeneeded = (event) => {
      // Legacy safe pattern: only create store if DB is empty
      const db = (event.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.length === 0) {
        db.createObjectStore(config.objectStoreName, { keyPath: 'key' });
      }
    };

    openRequest.onerror = () => {
      reject(new Error(`Failed to open ${config.dbName}: ${openRequest.error?.message}`));
    };

    openRequest.onblocked = () => {
      resolve(null);
    };

    openRequest.onsuccess = () => {
      const db = openRequest.result;

      try {
        if (!db.objectStoreNames.contains(config.objectStoreName)) {
          db.close();
          resolve(null);
          return;
        }

        const tx = db.transaction(config.objectStoreName, 'readonly');
        const store = tx.objectStore(config.objectStoreName);
        const getRequest = store.get('currentSessionSnapshot');

        getRequest.onsuccess = () => {
          db.close();
          const record = getRequest.result as
            | { key: string; data: unknown[] }
            | undefined;

          if (!record || !record.data) {
            resolve(null);
            return;
          }

          resolve(record.data);
        };

        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

/**
 * Check if a legacy database exists without accidentally creating it.
 *
 * Uses indexedDB.databases() where available (Chromium 100+),
 * falls back to opening with expected version and checking for stores.
 */
export async function legacyDbExists(
  config: LegacyDbConfig,
): Promise<boolean> {
  // Modern API: indexedDB.databases() (Chromium 100+)
  if (typeof indexedDB.databases === 'function') {
    const dbs = await indexedDB.databases();
    return dbs.some((db) => db.name === config.dbName);
  }

  // Fallback: open and check if the store exists with data
  return new Promise((resolve) => {
    const openRequest = indexedDB.open(config.dbName, config.dbVersion);

    openRequest.onupgradeneeded = () => {
      // Upgrade fired = DB didn't exist at this version. Abort to avoid creating it.
      openRequest.transaction?.abort();
    };

    openRequest.onerror = () => resolve(false);
    openRequest.onblocked = () => resolve(false);

    openRequest.onsuccess = () => {
      const db = openRequest.result;

      if (!db.objectStoreNames.contains(config.objectStoreName)) {
        db.close();
        resolve(false);
        return;
      }

      // Check if there's actual data in the store
      try {
        const tx = db.transaction(config.objectStoreName, 'readonly');
        const countRequest = tx.objectStore(config.objectStoreName).count();
        countRequest.onsuccess = () => {
          db.close();
          resolve(countRequest.result > 0);
        };
        countRequest.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch {
        db.close();
        resolve(false);
      }
    };
  });
}
