import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  BackupImportError,
  type BackupService,
  type Clock,
  type CollectionDef,
  type ImportMode,
  type StoredRecord,
} from '../../ports';
import type { RecordDriver } from '../core/driver';
import { getId, migrateRecord } from '../core/migrate';

/** Full export/import of every registered collection through a driver (no DOM). */
export function createBackupService(driver: RecordDriver, defs: readonly CollectionDef[], clock: Clock): BackupService {
  const byName = new Map(defs.map((d) => [d.name, d]));
  const names = defs.map((d) => d.name);

  return {
    async exportAll() {
      return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: clock.now().toISOString(),
        collections: await driver.snapshot(names),
      };
    },

    async importAll(file: unknown, mode: ImportMode) {
      const parsed = BackupFileSchema.safeParse(file);
      if (!parsed.success) throw new BackupImportError(`Invalid backup file: ${parsed.error.message}`, { cause: parsed.error });

      // Validate + migrate everything before the single write → all-or-nothing.
      const puts: Array<{ store: string; record: StoredRecord }> = [];
      const counts: Record<string, number> = {};
      for (const [name, records] of Object.entries(parsed.data.collections)) {
        const def = byName.get(name);
        if (!def) throw new BackupImportError(`Unknown collection "${name}"`);
        const seen = new Set<string>();
        for (const record of records) {
          const id = record.meta.id;
          if (seen.has(id)) throw new BackupImportError(`${name}: duplicate id "${id}"`);
          seen.add(id);
          if (getId(record.data) !== id) throw new BackupImportError(`${name}/${id}: data.id does not match meta.id`);
          try {
            puts.push({ store: name, record: migrateRecord(def, record) });
          } catch (cause) {
            throw new BackupImportError(cause instanceof Error ? cause.message : String(cause), { cause });
          }
        }
        counts[name] = records.length;
      }

      try {
        await driver.writeBatch({ clear: mode === 'replace' ? names : [], puts });
      } catch (cause) {
        throw new BackupImportError('Import failed; no changes were made', { cause });
      }
      return { mode, counts };
    },
  };
}
