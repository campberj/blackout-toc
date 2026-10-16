import {
  ALL_COLLECTIONS,
  COLLECTIONS,
  type BackupService,
  type Clock,
  type CollectionDef,
  type Identity,
  type Repository,
  type Storage,
} from '../ports';
import { createDriverStorage, toStoreSpecs, type RecordDriver } from '../adapters/core';
import { openIdbDriver } from '../adapters/idb';
import { createMemoryDriver } from '../adapters/memory';
import { createBackupService } from '../adapters/file';
import { createLocalIdentity, systemClock, type IdentityRecord } from '../adapters/system';

export interface StorageOptions {
  readonly dbName?: string;
  readonly clock?: Clock;
  readonly collections?: readonly CollectionDef[];
  /** Skip IndexedDB entirely (tests, explicit opt-out). */
  readonly inMemory?: boolean;
}

export interface AppStorage {
  readonly storage: Storage;
  readonly backup: BackupService;
  readonly identity: Identity;
  /** False → in-memory fallback; UI should warn that data won't survive reload. */
  readonly isPersistent: boolean;
  /** Why IndexedDB was not used, when it was attempted and failed. */
  readonly fallbackReason?: unknown;
  close(): void;
}

export const DEFAULT_DB_NAME = 'blkout-toc';

/** Composition root: IndexedDB when available, in-memory otherwise. */
export async function createStorage(opts: StorageOptions = {}): Promise<AppStorage> {
  const defs = opts.collections ?? ALL_COLLECTIONS;
  const clock = opts.clock ?? systemClock;
  const specs = toStoreSpecs(defs);

  let driver: RecordDriver;
  let fallbackReason: unknown;
  if (opts.inMemory) {
    driver = createMemoryDriver(specs);
  } else {
    try {
      driver = await openIdbDriver(opts.dbName ?? DEFAULT_DB_NAME, specs);
    } catch (err) {
      fallbackReason = err;
      driver = createMemoryDriver(specs);
    }
  }

  const storage = createDriverStorage(driver, defs, clock);
  const settings = defs.includes(COLLECTIONS.settings) ? COLLECTIONS.settings : undefined;
  if (!settings) throw new Error('createStorage: the settings collection is required (identity lives there)');

  return {
    storage,
    backup: createBackupService(driver, defs, clock),
    identity: createLocalIdentity(storage.collection(settings) as unknown as Repository<IdentityRecord>),
    isPersistent: driver.isPersistent,
    ...(fallbackReason === undefined ? {} : { fallbackReason }),
    close: () => driver.close(),
  };
}
