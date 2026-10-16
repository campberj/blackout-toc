import type { IndexValue, StoredRecord } from '../../ports';
import type { RecordDriver, StoreSpec, WriteBatch } from '../core/driver';
import { getPath, isIndexValue } from '../core/path';

type Stores = Map<string, Map<string, StoredRecord>>;

/** Backing state; share one between drivers to simulate reopening (tests). */
export interface MemoryState {
  stores: Stores;
}

export function createMemoryState(): MemoryState {
  return { stores: new Map() };
}

const byId = (a: StoredRecord, b: StoredRecord) => (a.meta.id < b.meta.id ? -1 : a.meta.id > b.meta.id ? 1 : 0);
// Copy on the way in and out, like IndexedDB's structured clone, so callers can't mutate stored state.
const clone = <T>(v: T): T => structuredClone(v);

export class ConstraintError extends Error {
  override readonly name = 'ConstraintError';
}

/** Non-persistent driver: fallback when IndexedDB is unavailable, and test double. */
export function createMemoryDriver(specs: readonly StoreSpec[], state: MemoryState = createMemoryState()): RecordDriver {
  const specByName = new Map(specs.map((s) => [s.name, s]));
  for (const s of specs) if (!state.stores.has(s.name)) state.stores.set(s.name, new Map());

  const spec = (name: string): StoreSpec => {
    const s = specByName.get(name);
    if (!s) throw new Error(`Unknown store "${name}"`);
    return s;
  };
  const table = (stores: Stores, name: string) => {
    spec(name);
    return stores.get(name) as Map<string, StoredRecord>;
  };
  const indexKey = (store: string, index: string, r: StoredRecord): unknown => {
    const def = spec(store).indexes.find((i) => i.name === index);
    if (!def) throw new Error(`Unknown index "${store}.${index}"`);
    return getPath(r.data, def.keyPath);
  };
  /** Mirrors IndexedDB unique-index ConstraintError. */
  const checkUnique = (stores: Stores, store: string, r: StoredRecord) => {
    for (const idx of spec(store).indexes) {
      if (!idx.unique) continue;
      const key = getPath(r.data, idx.keyPath);
      if (!isIndexValue(key)) continue;
      for (const other of table(stores, store).values())
        if (other.meta.id !== r.meta.id && getPath(other.data, idx.keyPath) === key)
          throw new ConstraintError(`Unique index "${store}.${idx.name}" violated`);
    }
  };

  return {
    isPersistent: false,
    async get(store, id) {
      const r = table(state.stores, store).get(id);
      return r && clone(r);
    },
    async getAll(store) {
      return [...table(state.stores, store).values()].sort(byId).map(clone);
    },
    async getByIndex(store, index, value: IndexValue) {
      return [...table(state.stores, store).values()]
        .filter((r) => indexKey(store, index, r) === value)
        .sort(byId)
        .map(clone);
    },
    async upsert(store, id, build) {
      const t = table(state.stores, store);
      const prev = t.get(id);
      const next = clone(build(prev && clone(prev)));
      checkUnique(state.stores, store, next);
      t.set(id, next);
    },
    async delete(store, id) {
      table(state.stores, store).delete(id);
    },
    async snapshot(names) {
      return Object.fromEntries(names.map((n) => [n, [...table(state.stores, n).values()].sort(byId).map(clone)]));
    },
    async writeBatch({ clear, puts }: WriteBatch) {
      // Stage on copies, swap only on success → all-or-nothing.
      const staged: Stores = new Map([...state.stores].map(([k, v]) => [k, new Map(v)]));
      for (const name of clear) table(staged, name).clear();
      for (const { store, record } of puts) {
        const r = clone(record);
        checkUnique(staged, store, r);
        table(staged, store).set(r.meta.id, r);
      }
      state.stores = staged;
    },
    close() {},
  };
}
