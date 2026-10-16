// Shared contract suite (DRY): every RecordDriver backend must pass it unchanged.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupImportError, defineCollection, type BackupFile, type CollectionDef, type Entity } from '../../ports';
import { createBackupService } from '../file/backup';
import { fixedClock } from '../system/clock';
import type { RecordDriver, StoreSpec } from './driver';
import { createDriverStorage, toStoreSpecs } from './storage';

/** Opens a driver; calls within one test with the same factory must see the same underlying data. */
export type DriverFactory = (specs: readonly StoreSpec[]) => Promise<RecordDriver>;

interface Note extends Entity {
  title: string;
  campaignId: string;
  slug?: string;
  tags?: string[];
}

// v1 {id,name,campaignId} → v2 rename name→title → v3 add tags.
const migrations = [
  (o: unknown) => {
    const { name, ...rest } = o as { name: string };
    return { ...rest, title: name };
  },
  (o: unknown) => ({ ...(o as object), tags: [] }),
];
const notesV1 = defineCollection<Entity>({ name: 'notes', schemaVersion: 1, migrations: [] });
const notesV3 = defineCollection<Note>({
  name: 'notes',
  schemaVersion: 3,
  migrations,
  indexes: [
    { name: 'byCampaign', keyPath: 'campaignId' },
    { name: 'bySlug', keyPath: 'slug', unique: true },
  ],
});
const other = defineCollection<Entity & { n: number }>({ name: 'other', schemaVersion: 1, migrations: [] });
const DEFS: CollectionDef[] = [notesV3, other];

const T0 = '2026-01-01T00:00:00.000Z';
const note = (id: string, extra: Partial<Note> = {}): Note => ({ id, title: id.toUpperCase(), campaignId: 'c1', tags: [], ...extra });

export function storageContract(label: string, makeFactory: () => DriverFactory): void {
  describe(`storage contract: ${label}`, () => {
    let factory: DriverFactory;
    const opened: RecordDriver[] = [];
    const open = async (defs: CollectionDef[] = DEFS, clock = fixedClock(T0, 1000)) => {
      const driver = await factory(toStoreSpecs(defs));
      opened.push(driver);
      return { driver, storage: createDriverStorage(driver, defs, clock), backup: createBackupService(driver, defs, clock) };
    };

    beforeEach(() => {
      factory = makeFactory();
    });
    afterEach(() => {
      opened.splice(0).forEach((d) => d.close());
    });

    describe('repository', () => {
      it('put/get/list/delete round-trip, list ordered by id', async () => {
        const repo = (await open()).storage.collection(notesV3);
        await repo.put(note('b'));
        await repo.put(note('a'));
        expect(await repo.get('a')).toEqual(note('a'));
        expect((await repo.list()).map((n) => n.id)).toEqual(['a', 'b']);
        await repo.delete('a');
        expect(await repo.get('a')).toBeUndefined();
        await repo.delete('missing');
        expect((await repo.list()).map((n) => n.id)).toEqual(['b']);
      });

      it('put replaces by id; collections are isolated', async () => {
        const { storage } = await open();
        await storage.collection(notesV3).put(note('a'));
        await storage.collection(notesV3).put(note('a', { title: 'NEW' }));
        await storage.collection(other).put({ id: 'a', n: 1 });
        expect(await storage.collection(notesV3).list()).toEqual([note('a', { title: 'NEW' })]);
        expect(await storage.collection(other).list()).toEqual([{ id: 'a', n: 1 }]);
      });

      it('stamps meta: createdAt kept, updatedAt advances, schemaVersion current', async () => {
        const { storage, driver } = await open();
        const repo = storage.collection(notesV3);
        await repo.put(note('a'));
        await repo.put(note('a', { title: 'X' }));
        const raw = await driver.get('notes', 'a');
        expect(raw?.meta).toEqual({ id: 'a', schemaVersion: 3, createdAt: T0, updatedAt: '2026-01-01T00:00:01.000Z' });
        expect(raw?.data).toEqual(note('a', { title: 'X' }));
      });

      it('returns copies, not live references', async () => {
        const repo = (await open()).storage.collection(notesV3);
        const n = note('a');
        await repo.put(n);
        n.title = 'mutated';
        const got = await repo.get('a');
        got!.title = 'mutated too';
        expect((await repo.get('a'))?.title).toBe('A');
      });

      it('query by index, ordered by id; rejects undeclared index', async () => {
        const repo = (await open()).storage.collection(notesV3);
        await repo.put(note('z', { campaignId: 'c2' }));
        await repo.put(note('b'));
        await repo.put(note('a'));
        expect((await repo.query!('byCampaign', 'c1')).map((n) => n.id)).toEqual(['a', 'b']);
        expect(await repo.query!('byCampaign', 'none')).toEqual([]);
        await expect(repo.query!('nope', 'c1')).rejects.toThrow(/no index/);
      });

      it('unique index violation rejects and leaves data unchanged', async () => {
        const repo = (await open()).storage.collection(notesV3);
        await repo.put(note('a', { slug: 's' }));
        await expect(repo.put(note('b', { slug: 's' }))).rejects.toThrow();
        expect((await repo.list()).map((n) => n.id)).toEqual(['a']);
      });

      it('rejects records without a string id and unregistered collections', async () => {
        const { storage } = await open();
        await expect(storage.collection(notesV3).put({ title: 'x' } as unknown as Note)).rejects.toThrow(/id/);
        expect(() => storage.collection(notesV1)).toThrow(/not registered/);
      });

      it('data survives reopening', async () => {
        await (await open()).storage.collection(notesV3).put(note('a'));
        expect(await (await open()).storage.collection(notesV3).get('a')).toEqual(note('a'));
      });
    });

    describe('migrations', () => {
      it('upgrades v1 → v3 lazily on read; persists v3 on next put', async () => {
        const v1 = (await open([notesV1, other])).storage.collection(notesV1);
        await v1.put({ id: 'a', name: 'Alpha', campaignId: 'c1' } as Entity);

        const { storage, driver } = await open();
        const repo = storage.collection(notesV3);
        const expected = { id: 'a', title: 'Alpha', campaignId: 'c1', tags: [] };
        expect(await repo.get('a')).toEqual(expected);
        expect(await repo.list()).toEqual([expected]);
        expect((await driver.get('notes', 'a'))?.meta.schemaVersion).toBe(1); // read is side-effect free

        await repo.put((await repo.get('a'))!);
        const raw = await driver.get('notes', 'a');
        expect(raw?.meta.schemaVersion).toBe(3);
        expect(raw?.meta.createdAt).toBe(T0);
      });

      it('refuses records newer than the code supports', async () => {
        await (await open()).storage.collection(notesV3).put(note('a'));
        const v1 = (await open([notesV1, other])).storage.collection(notesV1);
        await expect(v1.get('a')).rejects.toThrow(/newer/);
      });
    });

    describe('backup', () => {
      const v1File = (): BackupFile => ({
        format: 'blkout-backup',
        version: 1,
        exportedAt: T0,
        collections: {
          notes: [
            { meta: { id: 'a', schemaVersion: 1, createdAt: T0, updatedAt: T0 }, data: { id: 'a', name: 'Alpha', campaignId: 'c1' } },
            { meta: { id: 'b', schemaVersion: 2, createdAt: T0, updatedAt: T0 }, data: { id: 'b', title: 'Bravo', campaignId: 'c1' } },
          ],
        },
      });

      it('exportAll → importAll(replace) round-trips every collection', async () => {
        const src = await open();
        await src.storage.collection(notesV3).put(note('a'));
        await src.storage.collection(other).put({ id: 'x', n: 7 });
        const file = await src.backup.exportAll();
        expect(file).toMatchObject({ format: 'blkout-backup', version: 1, exportedAt: '2026-01-01T00:00:02.000Z' });
        const json = JSON.parse(JSON.stringify(file)) as unknown;

        await src.storage.collection(notesV3).put(note('stray'));
        const summary = await src.backup.importAll(json, 'replace');
        expect(summary).toEqual({ mode: 'replace', counts: { notes: 1, other: 1 } });
        expect((await src.backup.exportAll()).collections).toEqual(file.collections);
      });

      it('migrates eagerly on import (v1/v2 → v3 stored)', async () => {
        const { backup, driver, storage } = await open();
        await backup.importAll(v1File(), 'replace');
        const raw = await driver.getAll('notes');
        expect(raw.map((r) => r.meta.schemaVersion)).toEqual([3, 3]);
        expect(await storage.collection(notesV3).list()).toEqual([
          { id: 'a', title: 'Alpha', campaignId: 'c1', tags: [] },
          { id: 'b', title: 'Bravo', campaignId: 'c1', tags: [] },
        ]);
      });

      it('merge keeps unrelated records and overwrites same ids; replace clears', async () => {
        const { backup, storage } = await open();
        const repo = storage.collection(notesV3);
        await repo.put(note('a', { title: 'OLD' }));
        await repo.put(note('keep'));
        await storage.collection(other).put({ id: 'o', n: 1 });

        await backup.importAll(v1File(), 'merge');
        expect((await repo.list()).map((n) => [n.id, n.title])).toEqual([['a', 'Alpha'], ['b', 'Bravo'], ['keep', 'KEEP']]);
        expect(await storage.collection(other).list()).toHaveLength(1);

        await backup.importAll(v1File(), 'replace');
        expect((await repo.list()).map((n) => n.id)).toEqual(['a', 'b']);
        expect(await storage.collection(other).list()).toEqual([]);
      });

      it.each([
        ['not a backup', { hello: 1 }],
        ['wrong format', { ...v1File(), format: 'other' }],
        ['future envelope', { ...v1File(), version: 2 }],
        ['unknown collection', { ...v1File(), collections: { ghosts: [] } }],
        ['bad meta', { ...v1File(), collections: { notes: [{ meta: { id: 'a' }, data: { id: 'a' } }] } }],
      ])('rejects %s without writing', async (_l, bad) => {
        const { backup, storage } = await open();
        await storage.collection(notesV3).put(note('pre'));
        await expect(backup.importAll(bad, 'replace')).rejects.toBeInstanceOf(BackupImportError);
        expect((await storage.collection(notesV3).list()).map((n) => n.id)).toEqual(['pre']);
      });

      it('is all-or-nothing on a failing migration, id mismatch, duplicate id, or storage error', async () => {
        const { backup, storage } = await open();
        await storage.collection(notesV3).put(note('pre'));
        const f = v1File();
        const [a, b] = f.collections.notes!;
        const cases: BackupFile[] = [
          { ...f, collections: { notes: [a!, { ...b!, meta: { ...b!.meta, schemaVersion: 9 } }] } },
          { ...f, collections: { notes: [a!, { ...b!, data: { id: 'zzz' } }] } },
          { ...f, collections: { notes: [a!, a!] } },
          // Passes validation, fails in the store (unique index) → driver must roll back.
          {
            ...f,
            collections: {
              other: [{ meta: { id: 'o', schemaVersion: 1, createdAt: T0, updatedAt: T0 }, data: { id: 'o', n: 1 } }],
              notes: [3, 4].map((i) => ({
                meta: { id: `n${i}`, schemaVersion: 3, createdAt: T0, updatedAt: T0 },
                data: note(`n${i}`, { slug: 'dup' }),
              })),
            },
          },
        ];
        for (const bad of cases) {
          for (const mode of ['merge', 'replace'] as const) {
            await expect(backup.importAll(bad, mode)).rejects.toBeInstanceOf(BackupImportError);
            expect((await storage.collection(notesV3).list()).map((n) => n.id)).toEqual(['pre']);
            expect(await storage.collection(other).list()).toEqual([]);
          }
        }
      });
    });
  });
}
