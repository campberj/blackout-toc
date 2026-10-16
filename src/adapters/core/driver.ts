import type { IndexDef, IndexValue, StoredRecord } from '../../ports';

/** Physical layout of one collection, derived from its CollectionDef. */
export interface StoreSpec {
  readonly name: string;
  readonly indexes: readonly IndexDef[];
}

/**
 * Adapter-internal seam: raw envelope storage. Repository semantics (meta, migrations)
 * live once in core/, so each backend only implements this (DRY, LSP).
 */
export interface RecordDriver {
  readonly isPersistent: boolean;
  get(store: string, id: string): Promise<StoredRecord | undefined>;
  /** Ordered by id. */
  getAll(store: string): Promise<StoredRecord[]>;
  /** Exact match on a declared index, ordered by id. */
  getByIndex(store: string, index: string, value: IndexValue): Promise<StoredRecord[]>;
  /** Atomic read-modify-write; `build` receives the current record if any. */
  upsert(store: string, id: string, build: (prev: StoredRecord | undefined) => StoredRecord): Promise<void>;
  delete(store: string, id: string): Promise<void>;
  /** Consistent read of several stores. */
  snapshot(stores: readonly string[]): Promise<Record<string, StoredRecord[]>>;
  /** Atomic: clear `clear` stores, then write `puts`. Any failure leaves storage unchanged. */
  writeBatch(batch: WriteBatch): Promise<void>;
  close(): void;
}

export interface WriteBatch {
  readonly clear: readonly string[];
  readonly puts: ReadonlyArray<{ readonly store: string; readonly record: StoredRecord }>;
}
