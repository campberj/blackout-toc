import { describe, it, expect } from 'vitest';
import { defineCollection, type StoredRecord } from '../../ports';
import { MigrationError, migrateRecord } from './migrate';

const calls: string[] = [];
const def = defineCollection({
  name: 'things',
  schemaVersion: 3,
  migrations: [
    (o) => (calls.push('1→2'), { ...(o as object), v2: true }),
    (o) => (calls.push('2→3'), { ...(o as object), v3: true }),
  ],
});
const rec = (schemaVersion: number, data: unknown = { id: 'a' }): StoredRecord => ({
  meta: { id: 'a', schemaVersion, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  data,
});

describe('migrateRecord', () => {
  it('applies v1→v3 in order, bumps version, keeps timestamps, does not mutate input', () => {
    calls.length = 0;
    const input = rec(1);
    const out = migrateRecord(def, input);
    expect(calls).toEqual(['1→2', '2→3']);
    expect(out.data).toEqual({ id: 'a', v2: true, v3: true });
    expect(out.meta).toEqual({ ...input.meta, schemaVersion: 3 });
    expect(input).toEqual(rec(1));
  });
  it('starts mid-chain (v2→v3) and is identity when current', () => {
    calls.length = 0;
    expect(migrateRecord(def, rec(2)).data).toEqual({ id: 'a', v3: true });
    expect(calls).toEqual(['2→3']);
    const cur = rec(3);
    expect(migrateRecord(def, cur)).toBe(cur);
  });
  it.each([
    ['newer than supported', rec(4)],
    ['invalid version', rec(0)],
  ])('rejects %s', (_l, r) => {
    expect(() => migrateRecord(def, r)).toThrow(MigrationError);
  });
  it('wraps a throwing migration and rejects id loss', () => {
    const boom = defineCollection({ name: 'b', schemaVersion: 2, migrations: [() => { throw new Error('x'); }] });
    expect(() => migrateRecord(boom, rec(1))).toThrow(/v1→v2 failed/);
    const drop = defineCollection({ name: 'd', schemaVersion: 2, migrations: [() => ({})] });
    expect(() => migrateRecord(drop, rec(1))).toThrow(/id/);
  });
});
