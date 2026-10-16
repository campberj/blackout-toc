import { describe, expect, it } from 'vitest';
import { COLLECTIONS, type PackRecord } from '$lib/ports';
import type { Id } from '$lib/packs/schema';
import { bundle, draft, fx, memStorage } from './__fixtures__';
import { createCustomUnitService, slugify } from './custom-unit-service';
import { createPackLibrary, USER_PACK_ID } from './pack-library';

async function setup(active: Id | null = 'demo:house', extra: unknown[] = []) {
  const storage = memStorage();
  const library = createPackLibrary(storage, bundle(fx().other, fx().demo, ...extra));
  await library.init();
  return { storage, library, svc: createCustomUnitService({ library, activeRulesetId: () => active ?? undefined }) };
}
const must = <T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const userPack = async (storage: ReturnType<typeof memStorage>) => (await storage.collection(COLLECTIONS.packs).get(USER_PACK_ID)) as PackRecord & { raw: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('CustomUnitService', () => {
  it('create: slug id, user pack with derived requires, loaded as user:*', async () => {
    const { svc, storage, library } = await setup();
    const { unit, warnings } = must(await svc.create(draft()));
    expect(unit.id).toBe('user:night-wardens');
    expect(unit.source).toEqual({ custom: true });
    expect(warnings).toEqual([]);
    const rec = await userPack(storage);
    expect(rec.raw).toMatchObject({ id: 'user', version: '1.0.1', requires: [{ id: 'demo', range: '*' }] });
    expect(library.snapshot.registry.get('unit', 'user:night-wardens')?.name).toBe('Night Wardens');
    expect(svc.list().map((u) => u.id)).toEqual(['user:night-wardens']);

    // Same name again → suffixed id; explicit duplicate id → error.
    expect(must(await svc.create(draft())).unit.id).toBe('user:night-wardens-2');
    const dup = await svc.create(draft({ id: 'user:night-wardens' }));
    expect(dup.ok ? [] : dup.error.map((i) => i.code)).toEqual(['duplicate_id']);
    expect(must(await svc.create(draft({ id: 'custom-id', faction: 'other-demo:dune-runners', weapons: [{ key: 'w', name: 'W', keywords: [{ key: 'other-demo:smolder' }] }] }))).unit.id).toBe('user:custom-id');
    expect((await userPack(storage)).raw.requires).toEqual([
      { id: 'demo', range: '*' },
      { id: 'other-demo', range: '*' },
    ]);
  });

  it('ruleset limits block; calibration warnings pass through', async () => {
    const { svc, storage } = await setup();
    const bad = await svc.create(draft({ skill: 9, armor: { dice: 2, target: 6 } }));
    expect(bad.ok ? [] : bad.error.map((i) => `${i.severity}:${i.path}:${i.key}`)).toEqual([
      'error:skill:skill',
      'error:armor.dice:infantry-dice',
      'warning:armor.dice:two-dice-handlers',
    ]);
    expect(await userPack(storage)).toBeUndefined();
    const warned = must(await svc.create(draft({ skill: 5 })));
    expect(warned.warnings.map((w) => w.key)).toEqual(['skill-regular']);
  });

  it('schema and unresolved-ref errors are field-level', async () => {
    const { svc } = await setup();
    const s = await svc.create(draft({ move: 99 }));
    expect(s.ok ? [] : s.error.map((i) => `${i.code}:${i.path}`)).toEqual(['schema:move']);
    const r = await svc.create(draft({ faction: 'ghost:clan', keywords: [{ key: 'glasswing' }] }));
    expect(r.ok ? [] : r.error.map((i) => `${i.code}:${i.path}`)).toEqual(['unresolved:faction', 'unresolved:keywords.0.key']);
  });

  it('validate is sync and side-effect free', async () => {
    const { svc, storage } = await setup();
    expect(svc.validate(draft())).toEqual([]);
    expect(svc.validate(draft({ skill: 3 })).map((i) => `${i.severity}:${i.path}`)).toEqual(['error:skill', 'warning:skill']);
    expect(svc.validate(draft(), 'user:night-wardens')).toEqual([]);
    expect(await userPack(storage)).toBeUndefined();
  });

  it('no active ruleset → only reference + any-ruleset checks', async () => {
    const { svc } = await setup(null);
    expect(svc.validate(draft({ skill: 9 }))).toEqual([]);
  });

  it('update keeps position and bumps version; remove recomputes requires', async () => {
    const { svc, storage, library } = await setup();
    must(await svc.create(draft({ name: 'A' })));
    must(await svc.create(draft({ name: 'B', faction: 'other-demo:dune-runners', weapons: [{ key: 'w', name: 'W' }] })));
    const up = must(await svc.update('a', draft({ name: 'A Prime', move: 7 })));
    expect(up.unit).toMatchObject({ id: 'user:a', name: 'A Prime', move: 7 });
    let rec = await userPack(storage);
    expect(rec.raw.content.units.map((u: { id: string }) => u.id)).toEqual(['a', 'b']);
    expect(rec.raw.version).toBe('1.0.3');
    const bad = await svc.update('a', draft({ skill: 2 }));
    expect(bad.ok).toBe(false);
    const missing = await svc.update('zzz', draft());
    expect(missing.ok ? [] : missing.error.map((i) => i.code)).toEqual(['not_found']);

    must(await svc.remove('user:b'));
    rec = await userPack(storage);
    expect(rec.raw.requires).toEqual([{ id: 'demo', range: '*' }]);
    expect(library.snapshot.registry.get('unit', 'user:b')).toBeUndefined();
    const gone = await svc.remove('b');
    expect(gone.ok ? [] : gone.error.map((i) => i.code)).toEqual(['not_found']);
  });

  it('user pack blocks disabling the packs it uses; disabled user pack still saves', async () => {
    const { svc, library } = await setup();
    must(await svc.create(draft()));
    const blocked = await library.setEnabled('demo', false);
    expect(blocked.ok ? [] : blocked.error.map((e) => e.packId)).toEqual([USER_PACK_ID]);
    must(await library.setEnabled(USER_PACK_ID, false));
    const saved = must(await svc.create(draft({ name: 'Offline' })));
    expect(saved.unit.id).toBe('user:offline');
    expect(svc.list()).toEqual([]);
  });

  it('user pack keeps its own content; local refs resolve to user:*', async () => {
    const { svc, library } = await setup();
    must(await library.import({ format: 'blkout-pack', formatVersion: 1, id: 'user', version: '1.0.0', title: 'U', author: 'A', content: { factions: [{ id: 'mine', name: 'Mine' }] } }));
    const r = must(await svc.create(draft({ faction: 'mine' })));
    expect(r.unit.faction).toBe('user:mine');
    expect(JSON.parse(await svc.exportPack()).content.factions).toHaveLength(1);
  });

  it('loader rejections map to unit-relative paths or whole messages', async () => {
    const { library } = await setup();
    const errors = [
      { packId: 'user', code: 'unresolved_ref', path: '/content/units/0/weapons/1/keywords/0/key', message: 'Unknown keyword' },
      { packId: 'user', code: 'unresolved_ref', path: '/content/units/0', message: 'Whole unit' },
      { packId: 'user', code: 'dependency_version', path: '/requires/0/range', message: 'Too old' },
    ] as const;
    const stub = { ...library, snapshot: library.snapshot, raw: library.raw, import: async () => ({ ok: false as const, error: [...errors] }) };
    const svc = createCustomUnitService({ library: stub, activeRulesetId: () => undefined });
    const r = await svc.create(draft());
    expect(r.ok ? [] : r.error.map((i) => [i.path, i.message])).toEqual([
      ['weapons.1.keywords.0.key', 'Unknown keyword'],
      ['', 'Whole unit'],
      ['', 'Pack "user" › requires[0].range: Too old'],
    ]);
    const rm = await createCustomUnitService({ library, activeRulesetId: () => undefined }).create(draft());
    expect(rm.ok).toBe(true);
    const gone = await svc.remove('night-wardens');
    expect(gone.ok ? [] : gone.error.map((i) => i.path)).toEqual(['', '', '']);
  });

  it('slugify', () => {
    expect(slugify('  Night  Wardens!! ')).toBe('night-wardens');
    expect(slugify('***')).toBe('unit');
    expect(slugify('a'.repeat(60)).length).toBe(48);
  });
});
