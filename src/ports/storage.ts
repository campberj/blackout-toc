import type { CollectionDef } from './collection';
import type { Entity, Repository } from './repository';

/** Opens repositories for registered collections. */
export interface Storage {
  /** False on the in-memory fallback (private mode / no IndexedDB): data is lost on reload. */
  readonly isPersistent: boolean;
  /** Throws if `def` is not one of the collections the storage was opened with. */
  collection<T extends Entity>(def: CollectionDef<T>): Repository<T>;
}
