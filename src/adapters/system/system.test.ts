import { describe, it, expect } from 'vitest';
import { defineCollection } from '../../ports';
import { createDriverStorage, toStoreSpecs } from '../core/storage';
import { createMemoryDriver } from '../memory/driver';
import { fixedClock, systemClock } from './clock';
import { createLocalIdentity, IDENTITY_KEY, type IdentityRecord } from './identity';

describe('clocks', () => {
  it('fixedClock steps deterministically', () => {
    const c = fixedClock('2026-01-01T00:00:00Z', 500);
    expect([c.now(), c.now()].map((d) => d.toISOString())).toEqual(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.500Z']);
    expect(systemClock.now()).toBeInstanceOf(Date);
  });
});

describe('local identity', () => {
  const settings = defineCollection<IdentityRecord>({ name: 'settings', schemaVersion: 1, migrations: [] });
  const repo = () => createDriverStorage(createMemoryDriver(toStoreSpecs([settings])), [settings], fixedClock('2026-01-01T00:00:00Z')).collection(settings);

  it('mints once, persists, and is stable across instances and concurrent calls', async () => {
    const r = repo();
    let n = 0;
    const id = createLocalIdentity(r, () => `u${++n}`);
    const [a, b] = await Promise.all([id.userId(), id.userId()]);
    expect([a, b]).toEqual(['u1', 'u1']);
    expect(await createLocalIdentity(r, () => 'other').userId()).toBe('u1');
    expect(await r.get(IDENTITY_KEY)).toEqual({ id: IDENTITY_KEY, userId: 'u1' });
  });

  it('defaults to a random UUID', async () => {
    expect(await createLocalIdentity(repo()).userId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
