/** Anything persisted through a Repository carries a string id. */
export interface Entity {
  readonly id: string;
}

/** Index keys limited to types that compare identically in IndexedDB and in memory (no booleans: not valid IDB keys). */
export type IndexValue = string | number;

export interface Repository<T extends Entity> {
  get(id: string): Promise<T | undefined>;
  /** Insert or replace by `value.id`. */
  put(value: T): Promise<void>;
  delete(id: string): Promise<void>;
  /** All records, ordered by id. */
  list(): Promise<T[]>;
  /** Exact-match lookup on a declared index, ordered by id. */
  query?(index: string, value: IndexValue): Promise<T[]>;
}
