import { describe, expect, it } from 'vitest';
import { bundle, clock, fx, ids, memStorage } from './__fixtures__';
import { createAppContext } from './context';
import type { GameLaunchRequest } from './contracts/game-campaign';
import { COLLECTIONS, type Storage } from '../ports';

const launchReq = (over: Partial<GameLaunchRequest> = {}): GameLaunchRequest => ({
  campaignSaveId: 'save-1',
  mission: 'recover-lamp',
  missionName: 'Recover the Lamp',
  scenarioId: 'demo:lamp-recovery',
  operators: [
    { key: 'wren', name: 'Wren', team: 'Team Ember', unitId: 'demo:lantern-wardens' },
    { key: 'moss', name: 'Moss', team: 'Team Ember', unitId: 'demo:lantern-wardens' },
  ],
  ...over,
});

async function setup(storage: Storage = memStorage()) {
  const ctx = await createAppContext(storage, bundle(fx().other, fx().demo), { clock: clock(), newId: ids('s') });
  await ctx.settings.setActiveRuleset('demo:house');
  const r = await ctx.rosters.create({
    name: 'Ember Team',
    mode: 'matched',
    groups: [{ forceCardId: 'demo:lantern-detachment', handlerId: 'demo:warden-captain', unitIds: ['demo:lantern-wardens'] }],
  });
  if (!r.ok) throw new Error('roster');
  return { ctx, sessions: ctx.sessions, rosterId: r.value.roster.id, storage };
}

describe('session service', () => {
  it('creates from a roster, dispatches write-through, undoes per command, lists and removes', async () => {
    const { sessions, rosterId, storage } = await setup();
    const c = await sessions.create({ rosterId, scenarioId: 'demo:lamp-recovery' });
    if (!c.ok) throw new Error(c.error);
    const id = c.value.record.id;
    expect(c.value.missing).toEqual([]);
    expect(c.value.state).toMatchObject({ name: 'Ember Team', round: 1, scoreLabel: 'LP', rosterId });
    expect(c.value.record).toMatchObject({ name: 'Ember Team', createdAt: expect.any(String) });
    expect(c.value.record).not.toHaveProperty('link');

    const d = await sessions.dispatch(id, { type: 'useDrill', unit: 'p2' });
    expect(d.ok && d.value.state.sides.player.cp).toBe(2);
    expect(d.ok && d.value.log.at(-1)!.text).toBe('Ember Team spent 1 CP (Battle Drill)');
    const raw = (await storage.collection(COLLECTIONS.sessions).get(id)) as unknown as { events: unknown[] };
    expect(raw.events).toHaveLength(3);

    const blocked = await sessions.dispatch(id, { type: 'useDrill', unit: 'p2' });
    expect(blocked).toMatchObject({ ok: false, error: { overridable: true } });

    const u = await sessions.undo(id);
    expect(u.ok && u.value.state.sides.player.cp).toBe(3);
    expect(await sessions.undo(id)).toEqual({ ok: false, error: 'Nothing to undo: only the game start remains' });

    const list = await sessions.list();
    expect(list).toEqual([expect.objectContaining({ id, name: 'Ember Team', round: 1, roundLimit: 5, ended: false, scenarioName: 'Lamp Recovery' })]);

    expect((await sessions.rename(id, 'Night run')).ok).toBe(true);
    expect((await sessions.rename(id, '')).ok).toBe(false);
    expect((await sessions.open(id)).ok && (await sessions.list())[0]!.name).toBe('Night run');
    await sessions.remove(id);
    expect(await sessions.open(id)).toEqual({ ok: false, error: `Game "${id}" not found` });
    expect(await sessions.rename(id, 'x')).toMatchObject({ ok: false });
    expect(await sessions.undo(id)).toMatchObject({ ok: false });
    expect(await sessions.dispatch(id, { type: 'endGame' })).toMatchObject({ ok: false, error: { message: `Game "${id}" not found` } });
  });

  it('reloads from storage after a restart (replay) and rejects corrupt records', async () => {
    const { sessions, rosterId, storage } = await setup();
    const c = await sessions.create({ rosterId, name: 'Saved' });
    if (!c.ok) throw new Error(c.error);
    await sessions.dispatch(c.value.record.id, { type: 'note', text: 'kept' });
    const again = await createAppContext(storage, bundle(fx().other, fx().demo), { clock: clock() });
    const o = await again.sessions.open(c.value.record.id);
    expect(o.ok && o.value.state.notes.map((n) => n.text)).toEqual(['kept']);

    const repo = storage.collection(COLLECTIONS.sessions);
    await repo.put({ id: 'bad', name: '' } as never);
    await repo.put({ id: 'bad-log', name: 'X', createdAt: 'now', events: [{ seq: 1, type: 'Note', payload: { text: 'x' } }] } as never);
    expect(await again.sessions.open('bad')).toMatchObject({ ok: false, error: expect.stringMatching(/corrupt/) });
    expect(await again.sessions.open('bad-log')).toMatchObject({ ok: false, error: expect.stringMatching(/GameStarted/) });
    expect((await again.sessions.list()).map((s) => s.id)).toEqual([c.value.record.id]);
  });

  it('create reports missing rosters, scenarios, names and cards', async () => {
    const { ctx, sessions, rosterId } = await setup();
    expect(await sessions.create({ rosterId: 'nope' })).toEqual({ ok: false, error: 'Roster "nope" not found' });
    expect(await sessions.create({ rosterId, scenarioId: 'demo:nope' })).toEqual({ ok: false, error: 'Scenario "demo:nope" is not loaded' });
    expect((await sessions.create({ rosterId, name: ' ' })).ok).toBe(false);
    const r = await ctx.rosters.create({ name: 'Ghosts', mode: 'matched', groups: [{ unitIds: ['demo:ghost'] }] });
    const m = r.ok ? await sessions.create({ rosterId: r.value.roster.id }) : undefined;
    expect(m?.ok && m.value.missing).toEqual(['demo:ghost']);
  });

  it('quick-adds cards and custom contacts to OPFOR', async () => {
    const { sessions, rosterId } = await setup();
    const c = await sessions.create({ rosterId });
    if (!c.ok) throw new Error(c.error);
    const id = c.value.record.id;
    const q = await sessions.quickAdd(id, 'opfor', 'demo:choir-hulk', 2);
    expect(q.ok && q.value.state.units.filter((u) => u.side === 'opfor').map((u) => [u.key, u.name])).toEqual([
      ['o1', 'Choir Hulk 1'],
      ['o2', 'Choir Hulk 2'],
    ]);
    const one = await sessions.quickAdd(id, 'opfor', 'demo:choir-hulk');
    expect(one.ok && one.value.state.units.at(-1)!.name).toBe('Choir Hulk');
    expect(await sessions.quickAdd(id, 'opfor', 'demo:nope')).toMatchObject({ ok: false, error: { message: 'Unit "demo:nope" is not loaded' } });
    const k = await sessions.addContact(id, 'opfor', { name: 'Scavs', models: 2, track: { name: 'Hits', size: 1 } });
    expect(k.ok && k.value.state.units.at(-1)).toMatchObject({ name: 'Scavs', tracks: [{ size: 1 }] });
    expect(await sessions.addContact(id, 'opfor', { name: 'Scavs', models: 0 })).toMatchObject({ ok: false });
    expect(await sessions.quickAdd('nope', 'opfor', 'demo:choir-hulk')).toMatchObject({ ok: false });
  });

  it('end returns no prefill for unlinked games', async () => {
    const { sessions, rosterId } = await setup();
    const c = await sessions.create({ rosterId });
    if (!c.ok) throw new Error(c.error);
    const e = await sessions.end(c.value.record.id);
    expect(e.ok && e.value.state.ended).toBe(true);
    expect(e.ok && 'prefill' in e.value).toBe(false);
    expect(await sessions.end(c.value.record.id)).toMatchObject({ ok: false });
  });

  it('drops the cached engine when a write fails', async () => {
    const { sessions, rosterId, storage } = await setup();
    const c = await sessions.create({ rosterId });
    if (!c.ok) throw new Error(c.error);
    const id = c.value.record.id;
    const repo = storage.collection(COLLECTIONS.sessions);
    const put = repo.put.bind(repo);
    repo.put = () => Promise.reject(new Error('disk full'));
    await expect(sessions.dispatch(id, { type: 'note', text: 'lost' })).rejects.toThrow('disk full');
    repo.put = put;
    const o = await sessions.open(id);
    expect(o.ok && o.value.state.notes).toEqual([]);
  });
});

describe('campaign bridge', () => {
  it('launch → linked session (resumed while open) → end → prefill → consume', async () => {
    const { ctx } = await setup();
    const bridge = ctx.gameBridge;
    const id = await bridge.launch(launchReq());
    expect(await bridge.launch(launchReq())).toBe(id); // unfinished: resumed, not duplicated
    const o = await ctx.sessions.open(id);
    expect(o.ok && o.value.record.link).toEqual({ campaignSaveId: 'save-1', mission: 'recover-lamp' });
    expect(o.ok && o.value.state.units[0]!.models.map((m) => m.operatorKey)).toEqual(['wren', 'moss']);
    expect(await bridge.prefillFor('save-1', 'recover-lamp')).toBeUndefined();

    await ctx.sessions.dispatch(id, { type: 'creditKill', unit: 'p1', model: 'wren' });
    const ended = await ctx.sessions.end(id);
    expect(ended.ok && ended.value.prefill?.operators.wren).toEqual({ participated: true, kills: 1, status: 'ok' });

    const pre = await bridge.prefillFor('save-1', 'recover-lamp');
    expect(pre).toMatchObject({ campaignSaveId: 'save-1', mission: 'recover-lamp', rounds: 1, operators: { wren: { kills: 1 }, moss: { kills: 0 } } });
    expect(await bridge.prefillFor('save-1', 'other')).toBeUndefined();

    const second = await bridge.launch(launchReq()); // previous ended → new board
    expect(second).not.toBe(id);
    await bridge.consume('save-1', 'recover-lamp');
    expect(await bridge.prefillFor('save-1', 'recover-lamp')).toBeUndefined();
    const after = await ctx.sessions.open(id);
    expect(after.ok && after.value.record).not.toHaveProperty('link');
    const open2 = await ctx.sessions.open(second);
    expect(open2.ok && open2.value.record.link).toBeDefined(); // unfinished session untouched
  });

  it('newest ended session wins; launch errors reject', async () => {
    const { ctx } = await setup();
    const a = await ctx.gameBridge.launch(launchReq());
    await ctx.sessions.end(a);
    const b = await ctx.gameBridge.launch(launchReq());
    await ctx.sessions.dispatch(b, { type: 'creditKill', unit: 'p1', model: 'moss', delta: 3 });
    await ctx.sessions.end(b);
    expect((await ctx.gameBridge.prefillFor('save-1', 'recover-lamp'))?.operators.moss!.kills).toBe(3);
    await expect(ctx.gameBridge.launch(launchReq({ operators: [] }))).rejects.toThrow('Select at least one operator');
    await expect(ctx.gameBridge.launch(launchReq({ mission: 'm2', missionName: 'x'.repeat(81) }))).rejects.toThrow(/Name/);
  });
});
