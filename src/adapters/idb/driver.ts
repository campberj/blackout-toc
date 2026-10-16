import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { IndexValue, StoredRecord } from '../../ports';
import type { RecordDriver, StoreSpec, WriteBatch } from '../core/driver';

/** Stored shape is `{meta, data}`; keys and indexes point inside it. */
const KEY_PATH = 'meta.id';
const dataPath = (keyPath: string) => `data.${keyPath}`;

/**
 * Open (creating/upgrading as needed) an IndexedDB database whose stores match `specs`.
 * Schema is synced from the specs: the DB version is bumped only when a store or index
 * is missing or changed, so CollectionDefs stay the single source of truth.
 * Stores no longer declared are kept (never drop user data implicitly).
 * Throws if IndexedDB is unavailable or refuses to open (e.g. private mode).
 */
export async function openIdbDriver(dbName: string, specs: readonly StoreSpec[]): Promise<RecordDriver> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');

  let db = await open(dbName);
  if (needsUpgrade(db, specs)) {
    const version = db.version + 1;
    db.close();
    db = await open(dbName, version, specs);
  }
  return wrap(db, specs);
}

function open(name: string, version?: number, specs?: readonly StoreSpec[]): Promise<IDBPDatabase> {
  return openDB(name, version, {
    upgrade(_db, _old, _new, tx) {
      if (specs) syncSchema(tx, specs);
    },
    // Let another tab upgrade instead of deadlocking it; this connection becomes unusable.
    blocking(_cur, _next, event) {
      (event.target as IDBDatabase).close();
    },
  });
}

function needsUpgrade(db: IDBPDatabase, specs: readonly StoreSpec[]): boolean {
  if (specs.length === 0) return false;
  if (specs.some((s) => !db.objectStoreNames.contains(s.name))) return true;
  const tx = db.transaction(specs.map((s) => s.name), 'readonly');
  const stale = specs.some((s) => {
    const store = tx.objectStore(s.name);
    const declared = new Set(s.indexes.map((i) => i.name));
    if ([...store.indexNames].some((n) => !declared.has(n))) return true;
    return s.indexes.some((i) => {
      if (!store.indexNames.contains(i.name)) return true;
      const idx = store.index(i.name);
      return idx.keyPath !== dataPath(i.keyPath) || idx.unique !== !!i.unique;
    });
  });
  tx.abort();
  // Swallow the abort rejection: the transaction was only used for inspection.
  tx.done.catch(() => {});
  return stale;
}

function syncSchema(tx: IDBPTransaction<unknown, string[], 'versionchange'>, specs: readonly StoreSpec[]): void {
  const db = tx.db;
  for (const s of specs) {
    const store = db.objectStoreNames.contains(s.name)
      ? tx.objectStore(s.name)
      : db.createObjectStore(s.name, { keyPath: KEY_PATH });
    const declared = new Map(s.indexes.map((i) => [i.name, i]));
    for (const name of [...store.indexNames]) {
      const want = declared.get(name);
      const idx = store.index(name);
      if (!want || idx.keyPath !== dataPath(want.keyPath) || idx.unique !== !!want.unique) store.deleteIndex(name);
    }
    for (const i of s.indexes)
      if (!store.indexNames.contains(i.name)) store.createIndex(i.name, dataPath(i.keyPath), { unique: !!i.unique });
  }
}

function wrap(db: IDBPDatabase, specs: readonly StoreSpec[]): RecordDriver {
  const known = new Set(specs.map((s) => s.name));
  const check = (store: string) => {
    if (!known.has(store)) throw new Error(`Unknown store "${store}"`);
    return store;
  };
  return {
    isPersistent: true,
    get: (store, id) => db.get(check(store), id) as Promise<StoredRecord | undefined>,
    // Primary key is meta.id, so getAll / index results already come back ordered by id within equal keys.
    getAll: (store) => db.getAll(check(store)) as Promise<StoredRecord[]>,
    getByIndex: (store, index, value: IndexValue) => db.getAllFromIndex(check(store), index, value) as Promise<StoredRecord[]>,
    async upsert(store, id, build) {
      const tx = db.transaction(check(store), 'readwrite');
      const prev = (await tx.store.get(id)) as StoredRecord | undefined;
      await Promise.all([tx.store.put(build(prev)), tx.done]);
    },
    async delete(store, id) {
      await db.delete(check(store), id);
    },
    async snapshot(stores) {
      const tx = db.transaction(stores.map(check), 'readonly');
      const all = await Promise.all(stores.map((s) => tx.objectStore(s).getAll()));
      await tx.done;
      return Object.fromEntries(stores.map((s, i) => [s, all[i] as StoredRecord[]]));
    },
    async writeBatch({ clear, puts }: WriteBatch) {
      const names = [...new Set([...clear, ...puts.map((p) => p.store)])].map(check);
      if (names.length === 0) return;
      // One transaction: any failed request aborts it and rolls everything back.
      const tx = db.transaction(names, 'readwrite');
      const ops: Promise<unknown>[] = clear.map((s) => tx.objectStore(s).clear());
      for (const { store, record } of puts) ops.push(tx.objectStore(store).put(record));
      await Promise.all([...ops, tx.done]);
    },
    close: () => db.close(),
  };
}
