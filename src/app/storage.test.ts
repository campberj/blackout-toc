import { describe, it, expect, vi, afterEach } from 'vitest';
import { COLLECTIONS } from '../ports';
import { createStorage } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('createStorage', () => {
  it('falls back to memory with a reason when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const app = await createStorage();
    expect(app.isPersistent).toBe(false);
    expect(app.storage.isPersistent).toBe(false);
    expect(app.fallbackReason).toBeInstanceOf(Error);
    await app.storage.collection(COLLECTIONS.packs).put({ id: 'p', enabled: true, raw: {} });
    expect(await app.storage.collection(COLLECTIONS.packs).list()).toHaveLength(1);
  });

  it('falls back when IndexedDB throws on open (private mode)', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('denied', 'InvalidStateError'); } });
    const app = await createStorage();
    expect(app.isPersistent).toBe(false);
    expect(app.fallbackReason).toBeDefined();
  });

  it('inMemory skips IndexedDB; identity and backup are wired', async () => {
    const app = await createStorage({ inMemory: true });
    expect(app.fallbackReason).toBeUndefined();
    const uid = await app.identity.userId();
    const file = await app.backup.exportAll();
    expect(file.collections.settings?.map((r) => r.meta.id)).toEqual(['identity']);
    expect(Object.keys(file.collections)).toEqual(['packs', 'rosters', 'customUnits', 'sessions', 'campaigns', 'settings']);
    expect(await app.identity.userId()).toBe(uid);
    app.close();
  });

  it('requires the settings collection', async () => {
    await expect(createStorage({ inMemory: true, collections: [COLLECTIONS.packs] })).rejects.toThrow(/settings/);
  });
});
