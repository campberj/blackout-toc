import { describe, expect, it } from 'vitest';
import { COLLECTIONS } from '$lib/ports';
import { bundle, fx, memStorage, rulesPack } from './__fixtures__';
import { formatLoadError } from './errors';
import { BUNDLED_STATE_ID, createPackLibrary } from './pack-library';

async function lib(bundled: unknown[] = [], storage = memStorage()) {
  const l = createPackLibrary(storage, bundle(...bundled));
  await l.init();
  return { l, storage };
}
const must = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const codes = (r: { ok: boolean; error?: { code: string }[] }) => (r.ok ? [] : r.error!.map((e) => e.code));

describe('PackLibrary', () => {
  it('starts empty, imports objects and text, persists raw JSON', async () => {
    const { l, storage } = await lib();
    expect(l.snapshot.registry.list('unit')).toEqual([]);
    const { other, demo } = fx();
    must(await l.import(JSON.stringify(other)));
    const r = must(await l.import(demo));
    expect(r).toMatchObject({ id: 'demo', replaced: false });
    expect(l.snapshot.versions).toEqual({ 'other-demo': '1.2.0', demo: '0.1.0' });
    expect(l.snapshot.registry.get('unit', 'demo:lantern-wardens')?.name).toBe('Lantern Wardens');
    const rec = await storage.collection(COLLECTIONS.packs).get('demo');
    expect(rec).toEqual({ id: 'demo', enabled: true, raw: demo });
  });

  it('rejects invalid JSON, bad shape, missing deps — nothing persisted', async () => {
    const { l, storage } = await lib();
    expect(codes(await l.import('{nope'))).toEqual(['json_syntax']);
    expect(codes(await l.import({ format: 'blkout-pack' }))[0]).toBe('schema');
    const r = await l.import(fx().demo);
    expect(codes(r)).toEqual(['missing_dependency']);
    if (!r.ok) expect(formatLoadError(r.error[0]!)).toBe('Pack "demo" › requires[0].id: Requires pack "other-demo" (^1), which is not loaded');
    expect(await storage.collection(COLLECTIONS.packs).list()).toEqual([]);
  });

  it('replaces same id (keeps enabled state) and checks dependents still load', async () => {
    const { l } = await lib();
    const { other, demo } = fx();
    must(await l.import(other));
    must(await l.import(demo));
    const v2 = { ...other, version: '2.0.0' };
    expect(codes(await l.import(v2))).toEqual(['dependency_version']);
    const v13 = { ...other, version: '1.3.0' };
    expect(must(await l.import(v13)).replaced).toBe(true);
    expect(l.snapshot.versions['other-demo']).toBe('1.3.0');
  });

  it('import disabled: validated and stored, not loaded', async () => {
    const { l } = await lib();
    must(await l.import(fx().other, { enabled: false }));
    expect(l.snapshot.versions).toEqual({});
    expect((await l.list())[0]).toMatchObject({ id: 'other-demo', enabled: false, bundled: false });
  });

  it('disable/remove blocked by enabled dependents; enable checks deps', async () => {
    const { l } = await lib();
    const { other, demo } = fx();
    must(await l.import(other));
    must(await l.import(demo));
    const blocked = await l.setEnabled('other-demo', false);
    expect(codes(blocked)).toEqual(['required_by']);
    if (!blocked.ok) expect(formatLoadError(blocked.error[0]!)).toBe('Pack "demo" › requires[0].id: Requires "other-demo"; disable "demo" first');
    expect(codes(await l.remove('other-demo'))).toEqual(['required_by']);

    must(await l.setEnabled('demo', false));
    expect(must(await l.setEnabled('demo', false))).toBe(l.snapshot); // no-op
    must(await l.setEnabled('other-demo', false));
    expect(codes(await l.setEnabled('demo', true))).toEqual(['missing_dependency']);
    must(await l.setEnabled('other-demo', true));
    must(await l.setEnabled('demo', true));
    expect(l.snapshot.registry.get('unit', 'demo:lantern-wardens')).toBeDefined();

    // Disabled dependents don't block removal.
    must(await l.setEnabled('demo', false));
    must(await l.remove('other-demo'));
    must(await l.remove('demo')); // disabled: no reload needed
    expect(await l.list()).toEqual([]);
    expect(codes(await l.remove('demo'))).toEqual(['not_found']);
    expect(codes(await l.setEnabled('ghost', true))).toEqual(['not_found']);
  });

  it('bundled packs: always listed, read-only, disable persisted in settings', async () => {
    const storage = memStorage();
    const { l } = await lib([fx().other, rulesPack()], storage);
    expect(Object.keys(l.snapshot.versions)).toEqual(['other-demo', 'house-rules']);
    expect(codes(await l.import(fx().other))).toEqual(['read_only']);
    expect(codes(await l.remove('other-demo'))).toEqual(['read_only']);
    must(await l.setEnabled('house-rules', false));
    expect(await storage.collection(COLLECTIONS.settings).get(BUNDLED_STATE_ID)).toEqual({ id: BUNDLED_STATE_ID, disabled: ['house-rules'] });

    // New session over the same storage keeps it disabled.
    const { l: again } = await lib([fx().other, rulesPack()], storage);
    expect(Object.keys(again.snapshot.versions)).toEqual(['other-demo']);
    const info = await again.list();
    expect(info.map((i) => [i.id, i.bundled, i.enabled])).toEqual([
      ['other-demo', true, true],
      ['house-rules', true, false],
    ]);
    must(await again.setEnabled('house-rules', true));
    expect(Object.keys(again.snapshot.versions)).toContain('house-rules');
  });

  it('a stored copy of a bundled id is shadowed', async () => {
    const storage = memStorage();
    await storage.collection(COLLECTIONS.packs).put({ id: 'other-demo', enabled: true, raw: { ...fx().other, version: '1.9.0' } });
    const { l } = await lib([fx().other], storage);
    expect(l.snapshot.versions).toEqual({ 'other-demo': '1.2.0' });
  });

  it('list reports metadata, counts and unparseable stored packs', async () => {
    const storage = memStorage();
    await storage.collection(COLLECTIONS.packs).put({ id: 'broken', enabled: false, raw: { id: 'broken' } });
    const { l } = await lib([], storage);
    must(await l.import(fx().other));
    const [broken, other] = await l.list();
    expect(broken!.errors.length).toBeGreaterThan(0);
    expect(other).toMatchObject({ id: 'other-demo', version: '1.2.0', title: 'Other Demo (invented base content)', license: 'CC0-1.0', counts: { keyword: 1, faction: 1, unit: 1, ruleset: 1 } });
    const { demo } = fx();
    must(await l.import({ ...demo, description: 'Invented.' }));
    expect((await l.list()).find((i) => i.id === 'demo')?.description).toBe('Invented.');
  });

  it('rebuild surfaces a broken enabled set with an empty registry; export/raw', async () => {
    const storage = memStorage();
    await storage.collection(COLLECTIONS.packs).put({ id: 'demo', enabled: true, raw: fx().demo });
    const { l } = await lib([], storage);
    expect(l.snapshot.errors.map((e) => e.code)).toEqual(['missing_dependency']);
    expect(l.snapshot.registry.list('unit')).toEqual([]);
    const seen: number[] = [];
    const off = l.subscribe((s) => seen.push(s.errors.length));
    await storage.collection(COLLECTIONS.packs).put({ id: 'other-demo', enabled: true, raw: fx().other });
    must(await l.rebuild());
    off();
    expect(seen).toEqual([0]);
    expect(JSON.parse(must(await l.exportPack('demo')))).toEqual(fx().demo);
    expect(codes(await l.exportPack('nope'))).toEqual(['not_found']);
    expect(await l.raw('other-demo')).toEqual(fx().other);
  });

  it('bundled entries without an id still fail loudly', async () => {
    const { l } = await lib([{ format: 'blkout-pack' }]);
    expect(l.snapshot.errors[0]?.code).toBe('schema');
  });
});
