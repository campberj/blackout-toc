import type { CollectionDef, StoredRecord } from '../../ports';

export class MigrationError extends Error {
  override readonly name = 'MigrationError';
}

/**
 * Upgrade a stored record to the def's current schemaVersion by applying the pure
 * migrations in order. Returns the same record when already current.
 */
export function migrateRecord(def: CollectionDef, record: StoredRecord): StoredRecord {
  const from = record.meta.schemaVersion;
  const to = def.schemaVersion;
  const where = `${def.name}/${record.meta.id}`;
  if (!Number.isInteger(from) || from < 1) throw new MigrationError(`${where}: invalid schemaVersion ${from}`);
  if (from > to) throw new MigrationError(`${where}: schemaVersion ${from} is newer than supported ${to}`);
  if (from === to) return record;

  let data = record.data;
  for (let v = from; v < to; v++) {
    const step = def.migrations[v - 1];
    if (!step) throw new MigrationError(`${where}: missing migration v${v}→v${v + 1}`);
    try {
      data = step(data);
    } catch (cause) {
      throw new MigrationError(`${where}: migration v${v}→v${v + 1} failed`, { cause });
    }
  }
  if (getId(data) !== record.meta.id) throw new MigrationError(`${where}: migration changed or dropped the record id`);
  return { meta: { ...record.meta, schemaVersion: to }, data };
}

export function getId(data: unknown): unknown {
  return data !== null && typeof data === 'object' ? (data as { id?: unknown }).id : undefined;
}
