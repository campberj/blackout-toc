import type { Clock, CollectionDef, Entity, Repository, Storage } from '../../ports';
import type { RecordDriver, StoreSpec } from './driver';
import { createRepository } from './repository';

export function toStoreSpecs(defs: readonly CollectionDef[]): StoreSpec[] {
  const names = new Set<string>();
  return defs.map((d) => {
    if (names.has(d.name)) throw new Error(`Duplicate collection "${d.name}"`);
    names.add(d.name);
    return { name: d.name, indexes: d.indexes ?? [] };
  });
}

/** Storage port over a driver; repositories are cached per collection. */
export function createDriverStorage(driver: RecordDriver, defs: readonly CollectionDef[], clock: Clock): Storage {
  const registered = new Map(defs.map((d) => [d.name, d]));
  const repos = new Map<string, Repository<Entity>>();
  return {
    isPersistent: driver.isPersistent,
    collection<T extends Entity>(def: CollectionDef<T>): Repository<T> {
      if (registered.get(def.name) !== def) throw new Error(`Collection "${def.name}" is not registered with this storage`);
      let repo = repos.get(def.name);
      if (!repo) repos.set(def.name, (repo = createRepository(driver, def, clock)));
      return repo as unknown as Repository<T>;
    },
  };
}
