export {
  readLegacyDB,
  legacyDbExists,
  DB_V34,
  DB_V33,
} from './indexeddb-reader';
export type { LegacyDbConfig } from './indexeddb-reader';

export { loadTree, saveTree, treeExists } from './tree-storage';

export { migrateFromLegacy, isMigrationNeeded } from './migration';
export type { MigrationResult } from './migration';
