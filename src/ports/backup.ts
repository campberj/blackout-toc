import { z } from 'zod';
import { StoredRecordSchema } from './record';

export const BACKUP_FORMAT = 'blkout-backup';
/** Envelope version; bump with a converter if the envelope (not record data) changes. */
export const BACKUP_VERSION = 1;

export const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime({ offset: true }),
  collections: z.record(z.string(), z.array(StoredRecordSchema)),
});
export type BackupFile = z.infer<typeof BackupFileSchema>;

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  readonly mode: ImportMode;
  /** Records written per collection. */
  readonly counts: Readonly<Record<string, number>>;
}

/** Thrown when a backup is rejected; nothing has been written. */
export class BackupImportError extends Error {
  override readonly name = 'BackupImportError';
}

export interface BackupService {
  exportAll(): Promise<BackupFile>;
  /** All-or-nothing. `replace` clears every collection first; `merge` overwrites same ids. */
  importAll(file: unknown, mode: ImportMode): Promise<ImportSummary>;
}
