import type { Clock, CollectionDef, Entity, IndexValue, Repository, StoredRecord } from '../../ports';
import type { RecordDriver } from './driver';
import { migrateRecord } from './migrate';
import { isIndexValue } from './path';

/**
 * Repository over any RecordDriver. Stamps RecordMeta on write; upgrades lazily on read.
 * Reads never write back — the upgraded version is persisted on the next put.
 */
export function createRepository<T extends Entity>(driver: RecordDriver, def: CollectionDef<T>, clock: Clock): Repository<T> {
  const store = def.name;
  const indexNames = new Set((def.indexes ?? []).map((i) => i.name));
  const unwrap = (r: StoredRecord): T => migrateRecord(def, r).data as T;

  return {
    async get(id) {
      const r = await driver.get(store, id);
      return r && unwrap(r);
    },
    async put(value) {
      if (typeof value?.id !== 'string' || value.id === '') throw new TypeError(`${store}: record id must be a non-empty string`);
      const now = clock.now().toISOString();
      await driver.upsert(store, value.id, (prev) => ({
        meta: { id: value.id, schemaVersion: def.schemaVersion, createdAt: prev?.meta.createdAt ?? now, updatedAt: now },
        data: value,
      }));
    },
    delete: (id) => driver.delete(store, id),
    async list() {
      return (await driver.getAll(store)).map(unwrap);
    },
    async query(index: string, value: IndexValue) {
      if (!indexNames.has(index)) throw new Error(`${store}: no index "${index}"`);
      if (!isIndexValue(value)) throw new TypeError(`${store}: index value must be a string or number`);
      return (await driver.getByIndex(store, index, value)).map(unwrap);
    },
  };
}
