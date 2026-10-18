import type { AppContext } from '../../../app';

// Pure helpers for the full-backup panel. The service validates and writes; these only label things.

export type BackupService = NonNullable<AppContext['backup']>;
export type ImportMode = Parameters<BackupService['importAll']>[1];
export type ImportSummary = Awaited<ReturnType<BackupService['importAll']>>;

const LABELS: Record<string, [string, string]> = {
  packs: ['pack', 'packs'],
  rosters: ['roster', 'rosters'],
  campaigns: ['campaign', 'campaigns'],
  sessions: ['game', 'games'],
  settings: ['settings record', 'settings records'],
  customUnits: ['legacy unit record', 'legacy unit records'],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** `blkout-toc-backup-2026-10-16-1430` (local time; sorts by date). */
export function backupFilename(d: Date): string {
  return `blkout-toc-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** "3 rosters", "1 pack" … for non-empty collections, in a stable order. */
export function describeCounts(counts: Readonly<Record<string, number>>): string[] {
  const order = Object.keys(LABELS);
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b))
    .map(([k, n]) => {
      const [one, many] = LABELS[k] ?? [k, k];
      return `${n} ${n === 1 ? one : many}`;
    });
}

export interface BackupPreview {
  exportedAt: string;
  counts: Record<string, number>;
}

/** Envelope peek for the confirm dialog; null = not a backup file (the service gives the exact reason). */
export function previewBackup(file: unknown): BackupPreview | null {
  if (!file || typeof file !== 'object') return null;
  const f = file as { format?: unknown; exportedAt?: unknown; collections?: unknown };
  if (f.format !== 'blkout-backup' || typeof f.exportedAt !== 'string' || !f.collections || typeof f.collections !== 'object') return null;
  const counts = Object.fromEntries(Object.entries(f.collections as Record<string, unknown>).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
  return { exportedAt: f.exportedAt, counts };
}

/** Restore result as a sentence for the summary/toast. */
export function summaryText(s: ImportSummary): string {
  const what = describeCounts(s.counts);
  const verb = s.mode === 'replace' ? 'Replaced all data with' : 'Merged';
  return what.length ? `${verb} ${what.join(', ')}.` : s.mode === 'replace' ? 'All data was cleared; the backup was empty.' : 'The backup was empty; nothing changed.';
}

export const MODE_HELP: Record<ImportMode, string> = {
  merge: 'Keeps everything on this device. Records in the backup with the same id overwrite the local copy.',
  replace: 'Deletes all rosters, campaigns, games, imported packs and settings on this device, then restores the backup.',
};
