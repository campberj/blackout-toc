import { describe, expect, it } from 'vitest';
import { backupFilename, describeCounts, previewBackup, summaryText } from './backup-model';

describe('backup model', () => {
  it('names files by local date and time', () => {
    expect(backupFilename(new Date(2026, 9, 6, 9, 5))).toBe('blkout-toc-backup-2026-10-06-0905');
  });

  it('describes non-empty collections in a stable order', () => {
    expect(describeCounts({ settings: 1, rosters: 3, packs: 1, sessions: 0, other: 2 })).toEqual(['1 pack', '3 rosters', '1 settings record', '2 other']);
  });

  it('previews only backup envelopes', () => {
    expect(previewBackup({ format: 'blkout-backup', version: 1, exportedAt: '2026-10-16T12:00:00.000Z', collections: { rosters: [{}, {}], packs: 'x' } })).toEqual({
      exportedAt: '2026-10-16T12:00:00.000Z',
      counts: { rosters: 2, packs: 0 },
    });
    expect(previewBackup({ format: 'blkout-roster' })).toBeNull();
    expect(previewBackup('nope')).toBeNull();
  });

  it('summarizes merge and replace results', () => {
    expect(summaryText({ mode: 'merge', counts: { rosters: 1 } })).toBe('Merged 1 roster.');
    expect(summaryText({ mode: 'replace', counts: { packs: 2, rosters: 0 } })).toBe('Replaced all data with 2 packs.');
    expect(summaryText({ mode: 'replace', counts: {} })).toMatch(/cleared/);
  });
});
