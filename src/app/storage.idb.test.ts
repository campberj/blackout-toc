import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { COLLECTIONS } from '../ports';
import { createStorage } from './storage';

describe('createStorage with IndexedDB', () => {
  it('is persistent and survives reopen', async () => {
    const a = await createStorage({ dbName: 'app-test' });
    expect(a.isPersistent).toBe(true);
    await a.storage.collection(COLLECTIONS.rosters).put({ id: 'r1', name: 'Alpha' });
    const uid = await a.identity.userId();
    a.close();
    const b = await createStorage({ dbName: 'app-test' });
    expect(await b.storage.collection(COLLECTIONS.rosters).get('r1')).toEqual({ id: 'r1', name: 'Alpha' });
    expect(await b.identity.userId()).toBe(uid);
    b.close();
  });
});
