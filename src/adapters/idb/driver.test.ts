import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openDB } from 'idb';
import { openIdbDriver } from './driver';
import { storageContract } from '../core/storage.contract';

let n = 0;
storageContract('indexeddb', () => {
  const name = `contract-${n++}`;
  return (specs) => openIdbDriver(name, specs);
});

describe('idb schema sync', () => {
  it('adds stores/indexes by bumping version only when the declared schema changes', async () => {
    const name = 'sync-test';
    const a = await openIdbDriver(name, [{ name: 's', indexes: [] }]);
    a.close();
    const v1 = await openDB(name);
    const base = v1.version;
    v1.close();

    (await openIdbDriver(name, [{ name: 's', indexes: [] }])).close();
    expect((await peek(name)).version).toBe(base);

    (await openIdbDriver(name, [{ name: 's', indexes: [{ name: 'k', keyPath: 'k' }] }, { name: 't', indexes: [] }])).close();
    const after = await peek(name);
    expect(after.version).toBe(base + 1);
    expect(after.stores).toEqual(['s', 't']);
    expect(after.indexes).toEqual(['k']);

    // Changed index definition → recreated; removed collection's store kept.
    (await openIdbDriver(name, [{ name: 's', indexes: [{ name: 'k', keyPath: 'other', unique: true }] }])).close();
    const changed = await openDB(name);
    const idx = changed.transaction('s').store.index('k');
    expect([idx.keyPath, idx.unique]).toEqual(['data.other', true]);
    expect([...changed.objectStoreNames]).toEqual(['s', 't']);
    changed.close();
  });
});

async function peek(name: string) {
  const db = await openDB(name);
  const out = {
    version: db.version,
    stores: [...db.objectStoreNames],
    indexes: db.objectStoreNames.contains('s') ? [...db.transaction('s').store.indexNames] : [],
  };
  db.close();
  return out;
}
