import { describe, it, expect } from 'vitest';
import { ALL_COLLECTIONS, BackupFileSchema, COLLECTIONS, defineCollection } from '.';

describe('defineCollection', () => {
  it('accepts a consistent def', () => {
    const d = defineCollection({ name: 'x', schemaVersion: 2, migrations: [(o) => o] });
    expect(d.schemaVersion).toBe(2);
  });
  it.each([
    ['bad name', { name: '1x', schemaVersion: 1, migrations: [] }],
    ['version < 1', { name: 'x', schemaVersion: 0, migrations: [] }],
    ['migration count mismatch', { name: 'x', schemaVersion: 3, migrations: [(o: unknown) => o] }],
    ['duplicate index', { name: 'x', schemaVersion: 1, migrations: [], indexes: [{ name: 'i', keyPath: 'a' }, { name: 'i', keyPath: 'b' }] }],
  ])('rejects %s', (_l, def) => {
    expect(() => defineCollection(def)).toThrow();
  });
});

describe('collection registry', () => {
  it('declares the planned collections with unique names', () => {
    expect(ALL_COLLECTIONS.map((c) => c.name)).toEqual(['packs', 'rosters', 'customUnits', 'sessions', 'campaigns', 'settings']);
    expect(COLLECTIONS.packs.name).toBe('packs');
  });
});

describe('BackupFileSchema', () => {
  it('requires meta on every record', () => {
    const ok = { format: 'blkout-backup', version: 1, exportedAt: '2026-01-01T00:00:00Z', collections: {} };
    expect(BackupFileSchema.safeParse(ok).success).toBe(true);
    expect(BackupFileSchema.safeParse({ ...ok, collections: { a: [{ data: {} }] } }).success).toBe(false);
  });
});
