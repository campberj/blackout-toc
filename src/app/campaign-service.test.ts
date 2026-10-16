import { describe, expect, it } from 'vitest';
import { replayCampaign } from '$lib/domain/campaign';
import { COLLECTIONS } from '$lib/ports';
import type { Pack } from '$lib/packs/schema';
import { bundle, clock, fx, ids, memStorage } from './__fixtures__';
import { campaignPackVersions, createCampaignService, packDrift, type OpenCampaign } from './campaign-service';
import { createPackLibrary } from './pack-library';

async function setup() {
  const storage = memStorage();
  const library = createPackLibrary(storage, bundle(fx().other, fx().demo));
  await library.init();
  const svc = createCampaignService({
    storage,
    content: () => library.snapshot,
    clock: clock(),
    newId: ids('save'),
    newSeed: () => 7,
    excludedTags: () => ['loot'],
  });
  return { storage, library, svc };
}
const must = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const aarFor = (o: OpenCampaign) => {
  const mission = o.available[0]!.key;
  const ops = Object.values(o.state.operators).filter((x) => x.status === 'active');
  return { type: 'resolveAar' as const, aar: { mission, outcome: 'success', operators: Object.fromEntries(ops.map((x) => [x.key, { kills: 1 }])) } };
};

describe('CampaignService', () => {
  it('creates a save with pack closure versions, seed and default filter', async () => {
    const { svc, storage } = await setup();
    const o = must(await svc.create({ name: 'Night One', campaign: 'demo:long-night', teams: [{ key: 'ember' }] }));
    expect(o.save).toMatchObject({ id: 'save-1', name: 'Night One', campaignId: 'demo:long-night', packVersions: { demo: '0.1.0', 'other-demo': '1.2.0' } });
    expect(o.save.events).toHaveLength(1);
    expect(o.state).toMatchObject({ status: 'active', seed: 7, excludedTags: ['loot'] });
    expect(o.drift).toEqual([]);
    expect(o.available.length).toBeGreaterThan(0);
    expect(await storage.collection(COLLECTIONS.campaigns).get('save-1')).toEqual(o.save);
    expect(await svc.list()).toEqual([
      { id: 'save-1', name: 'Night One', campaignId: 'demo:long-night', createdAt: o.save.createdAt, events: 1, lastAt: o.save.events[0]!.at },
    ]);
  });

  it('rejects bad names and engine refusals', async () => {
    const { svc } = await setup();
    expect((await svc.create({ name: ' ', campaign: 'demo:long-night', teams: [{ key: 'ember' }] })).ok).toBe(false);
    const r = await svc.create({ name: 'X', campaign: 'demo:nope', teams: [{ key: 'ember' }], seed: 1 });
    expect(r.ok).toBe(false);
  });

  it('dispatch is write-through; reopening replays to the same state', async () => {
    const { svc, storage, library } = await setup();
    const o = must(await svc.create({ name: 'N', campaign: 'demo:long-night', teams: [{ key: 'ember' }] }));
    const d = must(await svc.dispatch(o.save.id, aarFor(o)));
    expect(d.events.map((e) => e.type)).toEqual(['MissionBegun', 'AarResolved']);
    expect(d.save.events).toHaveLength(3);
    expect(((await storage.collection(COLLECTIONS.campaigns).get(o.save.id)) as unknown as { events: unknown[] }).events).toHaveLength(3);
    expect(d.state).toEqual(replayCampaign(library.snapshot.registry, d.save.events as never));

    // Fresh service over the same storage (no cache).
    const fresh = createCampaignService({ storage, content: () => library.snapshot, clock: clock(), newId: ids(), newSeed: () => 1 });
    expect(must(await fresh.open(o.save.id)).state).toEqual(d.state);

    const bad = await svc.dispatch(o.save.id, { type: 'beginMission', mission: 'nope' });
    expect(bad.ok).toBe(false);
    expect((await svc.open('missing')).ok).toBe(false);
  });

  it('preview does not persist; undo drops the last event but never the start', async () => {
    const { svc } = await setup();
    const o = must(await svc.create({ name: 'N', campaign: 'demo:long-night', teams: [{ key: 'ember' }] }));
    const p = must(await svc.preview(o.save.id, aarFor(o)));
    expect(p.events).toHaveLength(2);
    expect(must(await svc.open(o.save.id)).save.events).toHaveLength(1);
    expect((await svc.preview(o.save.id, { type: 'beginMission', mission: 'nope' })).ok).toBe(false);

    must(await svc.dispatch(o.save.id, aarFor(o)));
    // One event per undo: the AAR goes, the implicit MissionBegun stays (mission active again).
    const u = must(await svc.undo(o.save.id));
    expect(u.save.events.map((e) => e.type)).toEqual(['CampaignStarted', 'MissionBegun']);
    expect(u.state.activeMission).toBe(o.available[0]!.key);
    expect(must(await svc.undo(o.save.id)).state).toEqual(o.state);
    expect(await svc.undo(o.save.id)).toEqual({ ok: false, error: 'Nothing to undo: only the campaign start remains' });
  });

  it('reports pack drift as a warning and re-replays when the registry changes', async () => {
    const { svc, library } = await setup();
    const o = must(await svc.create({ name: 'N', campaign: 'demo:long-night', teams: [{ key: 'ember' }] }));
    // Swap in a newer demo via a fresh library state: import is blocked for bundled, so simulate with drift helper too.
    expect(packDrift({ demo: '0.1.0', gone: '1.0.0' }, { demo: '0.2.0' })).toEqual([
      { packId: 'demo', expected: '0.1.0', actual: '0.2.0' },
      { packId: 'gone', expected: '1.0.0', actual: null },
    ]);
    const { demo, other } = fx();
    const storage2 = memStorage();
    const lib2 = createPackLibrary(storage2, bundle(other, { ...demo, version: '0.1.5' }));
    await lib2.init();
    let current = library.snapshot;
    const svc2 = createCampaignService({ storage: storage2, content: () => current, clock: clock(), newId: ids('b'), newSeed: () => 7 });
    const imported = must(await svc2.importSave(must(await svc.exportSave(o.save.id))));
    expect(imported.drift).toEqual([]);
    current = lib2.snapshot; // registry changed → cache invalidated → drift visible
    expect(must(await svc2.open(imported.save.id)).drift).toEqual([{ packId: 'demo', expected: '0.1.0', actual: '0.1.5' }]);
  });

  it('export/import round-trips; collisions get a new id; bad input rejected', async () => {
    const { svc } = await setup();
    const o = must(await svc.create({ name: 'N', campaign: 'demo:long-night', teams: [{ key: 'ember' }] }));
    must(await svc.dispatch(o.save.id, aarFor(o)));
    const json = must(await svc.exportSave(o.save.id));
    const copy = must(await svc.importSave(json));
    expect(copy.save.id).toBe('save-2');
    expect(copy.save.events).toEqual(JSON.parse(json).save.events);

    expect((await svc.importSave('{')).ok).toBe(false);
    expect((await svc.importSave({ format: 'nope' })).ok).toBe(false);
    const env = JSON.parse(json);
    const badSeq = structuredClone(env);
    badSeq.save.events[1].seq = 5;
    expect((await svc.importSave(badSeq)).ok).toBe(false);
    const badPayload = structuredClone(env);
    badPayload.save.events[1].payload = { aar: 'x' };
    expect((await svc.importSave(badPayload)).ok).toBe(false);
    const noStart = structuredClone(env);
    noStart.save.events = [{ ...env.save.events[1], seq: 1 }];
    const r = await svc.importSave(noStart);
    expect(r.ok).toBe(false);
    expect((await svc.exportSave('missing')).ok).toBe(false);
  });

  it('rename, remove, corrupt records', async () => {
    const { svc, storage } = await setup();
    const o = must(await svc.create({ name: 'N', campaign: 'demo:long-night', teams: [{ key: 'ember' }] }));
    expect(must(await svc.rename(o.save.id, 'Renamed')).name).toBe('Renamed');
    expect((await svc.rename(o.save.id, '')).ok).toBe(false);
    expect((await svc.rename('missing', 'x')).ok).toBe(false);
    await storage.collection(COLLECTIONS.campaigns).put({ id: 'junk', nope: true });
    expect((await svc.open('junk')).ok).toBe(false);
    expect((await svc.list()).map((s) => s.id)).toEqual([o.save.id]);
    await svc.remove(o.save.id);
    expect(await svc.list()).toEqual([]);
  });

  it('campaignPackVersions follows requires transitively', () => {
    const packs = [
      { id: 'a', version: '1.0.0', requires: [{ id: 'b', range: '*' }] },
      { id: 'b', version: '2.0.0', requires: [{ id: 'a', range: '*' }, { id: 'c', range: '*' }] },
      { id: 'd', version: '1.0.0', requires: [] },
    ] as unknown as Pack[];
    expect(campaignPackVersions('a:x', packs)).toEqual({ a: '1.0.0', b: '2.0.0' });
  });
});
