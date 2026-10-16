import type { Entity } from './repository';

/** Pure upgrade of one record from version n to n+1. */
export type Migration = (old: unknown) => unknown;

export interface IndexDef {
  readonly name: string;
  /** Dotted path within the record value, e.g. `campaignId` or `owner.id`. */
  readonly keyPath: string;
  readonly unique?: boolean;
}

/** A collection declared as data. */
export interface CollectionDef<T extends Entity = Entity> {
  readonly name: string;
  readonly schemaVersion: number;
  /** `migrations[i]` upgrades v(i+1) → v(i+2); length is always `schemaVersion - 1`. */
  readonly migrations: readonly Migration[];
  readonly indexes?: readonly IndexDef[];
  /** Phantom: carries T for inference only. Never set. */
  readonly __record?: T;
}

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Validates invariants once at declaration so a bad def fails at load, not on first read. */
export function defineCollection<T extends Entity>(def: Omit<CollectionDef<T>, '__record'>): CollectionDef<T> {
  if (!NAME_RE.test(def.name)) throw new Error(`Invalid collection name "${def.name}"`);
  if (!Number.isInteger(def.schemaVersion) || def.schemaVersion < 1)
    throw new Error(`${def.name}: schemaVersion must be an integer >= 1`);
  if (def.migrations.length !== def.schemaVersion - 1)
    throw new Error(`${def.name}: expected ${def.schemaVersion - 1} migrations, got ${def.migrations.length}`);
  const names = (def.indexes ?? []).map((i) => i.name);
  if (new Set(names).size !== names.length) throw new Error(`${def.name}: duplicate index name`);
  return def;
}
