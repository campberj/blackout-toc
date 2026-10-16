import { describe, expect, it } from 'vitest';
import { COLLECTIONS } from '$lib/ports';
import type { Id } from '$lib/packs/schema';
import { bundle, fx, ids, memStorage } from './__fixtures__';
import { createPackLibrary } from './pack-library';
import { createRosterService, type NewRosterInput } from './roster-service';

async function setup(active: Id | null = 'demo:house') {
  const storage = memStorage();
  const library = createPackLibrary(storage, bundle(fx().other, fx().demo));
  await library.init();
  return { storage, svc: createRosterService({ storage, content: () => library.snapshot, activeRulesetId: () => active ?? undefined, newId: ids('roster') }) };
}
const valid = (): NewRosterInput => ({
  name: 'Lantern Team',
  mode: 'matched',
  groups: [{ forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens', 'demo:choir-hulk', 'other-demo:scout-bike'] }],
  handlerId: 'demo:warden-captain',
});
const must = <T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

describe('RosterService', () => {
  it('create defaults the ruleset, assigns an id, persists and validates', async () => {
    const { svc, storage } = await setup();
    const { roster, issues } = must(await svc.create(valid()));
    expect(roster).toMatchObject({ id: 'roster-1', rulesetId: 'demo:house', notes: '' });
    expect(issues).toEqual([]);
    expect(await storage.collection(COLLECTIONS.rosters).get('roster-1')).toEqual(roster);
    expect(await svc.get('roster-1')).toEqual(roster);
    expect(await svc.list()).toEqual([roster]);
  });

  it('drafts save with rules issues; shape errors block with field paths', async () => {
    const { svc } = await setup();
    const draft = must(await svc.create({ name: 'Draft', mode: 'matched' }));
    expect(draft.issues.map((i) => i.path)).toEqual(['groups']);
    const bad = await svc.update({ ...draft.roster, groups: [{ unitIds: ['bare-id' as Id] }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error[0]).toMatchObject({ severity: 'error', path: 'groups.0.unitIds.0', code: 'schema' });
    expect(svc.validate({ ...draft.roster, name: '' })[0]?.path).toBe('name');
    expect(svc.validate({ ...draft.roster, ...valid() })).toEqual([]);
  });

  it('no ruleset loaded → clear error', async () => {
    const { svc } = await setup(null);
    const r = await svc.create(valid());
    expect(r.ok ? [] : r.error.map((i) => i.path)).toEqual(['rulesetId']);
    expect(must(await svc.create({ ...valid(), rulesetId: 'demo:house' })).issues).toEqual([]);
  });

  it('print model resolves cards, names, missing ids and issues', async () => {
    const { svc } = await setup();
    const { roster } = must(await svc.create({ ...valid(), dusterId: 'demo:ghost', notes: 'Bring lamps.' }));
    const pm = svc.printModel(roster);
    expect(pm).toMatchObject({ name: 'Lantern Team', ruleset: 'House Rules', mode: 'Matched', notes: 'Bring lamps.', missing: ['demo:ghost'] });
    expect(pm.handler?.name).toBe('Warden Captain');
    expect(pm.duster).toBeUndefined();
    expect(pm.groups[0]!.force?.name).toBe('Lantern Detachment');
    expect(pm.groups[0]!.units.map((u) => u.name)).toEqual(['Lantern Wardens', 'Choir Hulk', 'Scout Bike']);
    expect(pm.issues.map((i) => i.path)).toEqual(['dusterId']);

    const orphan = svc.printModel({ ...roster, rulesetId: 'x:y', groups: [{ forceCardId: 'x:f', unitIds: [] }, { unitIds: [] }] });
    expect(orphan).toMatchObject({ ruleset: 'x:y', mode: 'matched', missing: ['demo:ghost', 'x:f'] });
    expect(orphan.groups[1]).toEqual({ units: [] });
  });

  it('export/import with a fresh id; bare roster accepted; junk rejected; remove', async () => {
    const { svc } = await setup();
    const { roster } = must(await svc.create(valid()));
    const json = must(await svc.exportRoster(roster.id));
    expect(JSON.parse(json)).toMatchObject({ format: 'blkout-roster', version: 1 });
    expect(must(await svc.importRoster(json)).roster).toEqual({ ...roster, id: 'roster-2' });
    expect(must(await svc.importRoster(roster)).roster.id).toBe('roster-3');
    expect((await svc.importRoster('{')).ok).toBe(false);
    expect((await svc.importRoster('42')).ok).toBe(false);
    expect((await svc.exportRoster('missing')).ok).toBe(false);
    await svc.remove(roster.id);
    expect(await svc.get(roster.id)).toBeUndefined();
    expect((await svc.list()).map((r) => r.id)).toEqual(['roster-2', 'roster-3']);
  });

  it('list skips corrupt records', async () => {
    const { svc, storage } = await setup();
    await storage.collection(COLLECTIONS.rosters).put({ id: 'junk' });
    expect(await svc.list()).toEqual([]);
  });
});
