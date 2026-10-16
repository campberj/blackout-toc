import { defineCollection, type CollectionDef } from './collection';
import type { Entity } from './repository';
import { ROSTER_MIGRATIONS, ROSTER_SCHEMA_VERSION } from '../domain/roster/migrations';

/** Placeholder until the owning domain module types the record; narrow the def's T then. */
export type UntypedRecord = Entity & Record<string, unknown>;

/** Imported pack: raw JSON kept verbatim so it can be re-validated by newer loaders. id = packId. */
export interface PackRecord {
  readonly id: string;
  readonly enabled: boolean;
  readonly raw: unknown;
}

/** Registry of every persisted collection. Adding one here is all IndexedDB needs (schema syncs on open). */
export const COLLECTIONS = {
  packs: defineCollection<PackRecord>({ name: 'packs', schemaVersion: 1, migrations: [] }),
  rosters: defineCollection<UntypedRecord>({ name: 'rosters', schemaVersion: ROSTER_SCHEMA_VERSION, migrations: ROSTER_MIGRATIONS }),
  /** Reserved, unused: Forge output is stored as the `user` pack in `packs` (WPA). Kept so existing DBs/backups stay valid. */
  customUnits: defineCollection<UntypedRecord>({ name: 'customUnits', schemaVersion: 1, migrations: [] }),
  sessions: defineCollection<UntypedRecord>({ name: 'sessions', schemaVersion: 1, migrations: [] }),
  campaigns: defineCollection<UntypedRecord>({ name: 'campaigns', schemaVersion: 1, migrations: [] }),
  settings: defineCollection<UntypedRecord>({ name: 'settings', schemaVersion: 1, migrations: [] }),
} as const;

export const ALL_COLLECTIONS: readonly CollectionDef[] = Object.values(COLLECTIONS);
