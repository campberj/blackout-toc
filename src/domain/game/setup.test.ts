import { describe, expect, it } from 'vitest';
import type { GameLaunchRequest } from '../../app/contracts/game-campaign';
import { lookup, must, roster } from './__fixtures__/game';
import {
  createGameEngine,
  describeEvent,
  FALLBACK_PROFILE,
  gameLog,
  modelsForCard,
  observedStatus,
  scenarioParts,
  setupFromLaunch,
  setupFromRoster,
  templateFromContact,
  toAarPrefill,
  type GameEvent,
  type ModelState,
} from './index';

const launch = (over: Partial<GameLaunchRequest> = {}): GameLaunchRequest => ({
  campaignSaveId: 'save-1',
  mission: 'recover-lamp',
  missionName: 'Recover the Lamp',
  scenarioId: 'demo:lamp-recovery',
  operators: [
    { key: 'wren', name: 'Wren', callsign: 'WREN-1', team: 'Team Ember', unitId: 'demo:lantern-wardens' },
    { key: 'moss', name: 'Moss', team: 'Team Ember', unitId: 'demo:lantern-wardens' },
    { key: 'juno', name: 'Juno', team: 'Team Cinder' },
    { key: 'ghost', name: 'Ghost', team: 'Team Cinder', unitId: 'demo:nope' },
  ],
  ...over,
});

describe('setupFromLaunch', () => {
  it('turns operators into named models carrying operatorKey, grouped by team + card', () => {
    const r = setupFromLaunch({ req: launch(), lookup: lookup(), rulesetId: 'demo:house' });
    if (!r.ok) throw new Error(r.error);
    const { setup, missing } = r.value;
    expect(missing).toEqual(['demo:nope']);
    expect(setup).toMatchObject({ name: 'Recover the Lamp', link: { campaignSaveId: 'save-1', mission: 'recover-lamp' }, scenarioId: 'demo:lamp-recovery', startingCp: 3 });
    expect(setup.units!.map((u) => [u.key, u.name, u.models.map((m) => [m.key, m.name, m.operatorKey])])).toEqual([
      ['p1', 'Lantern Wardens (Team Ember)', [['wren', 'WREN-1', 'wren'], ['moss', 'Moss', 'moss']]],
      ['p2', 'Team Cinder', [['juno', 'Juno', 'juno']]],
      ['p3', 'Team Cinder', [['ghost', 'Ghost', 'ghost']]],
      ['o1', 'Choir Hulk 1', [['g1', 'Choir Hulk', undefined]]],
      ['o2', 'Choir Hulk 2', [['g1', 'Choir Hulk', undefined]]],
    ]);
    expect(setup.units![0]!.rules).toHaveLength(2);
  });

  it('falls back to default profile without a ruleset; rejects empty and unknown scenarios', () => {
    const r = setupFromLaunch({ req: launch({ scenarioId: undefined as never }), lookup: lookup() });
    expect(r.ok && r.value.setup).toMatchObject({ startingCp: FALLBACK_PROFILE.startingCp, roundLimit: 5, cpCaps: {}, sides: { opfor: { name: 'OPFOR' } } });
    expect(r.ok && 'scenarioId' in r.value.setup).toBe(false);
    expect(setupFromLaunch({ req: launch({ operators: [] }), lookup: lookup() })).toEqual({ ok: false, error: 'Select at least one operator' });
    expect(setupFromLaunch({ req: launch({ scenarioId: 'demo:nope' }), lookup: lookup() })).toEqual({ ok: false, error: 'Scenario "demo:nope" is not loaded' });
  });
});

describe('setupFromRoster', () => {
  it('includes a duster and reports missing cards', () => {
    const r = setupFromRoster({
      roster: roster({ dusterId: 'demo:warden-captain', groups: [{ unitIds: ['demo:lantern-wardens', 'demo:ghost'] }] }),
      lookup: lookup(),
      name: 'Night run',
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.missing).toEqual(['demo:ghost']);
    expect(r.value.setup.name).toBe('Night run');
    expect(r.value.setup.units!.map((u) => [u.name, u.group, u.forceId])).toEqual([
      ['Lantern Wardens', 0, undefined],
      ['Warden Captain', 0, undefined],
    ]);
    const missingDuster = setupFromRoster({ roster: roster({ dusterId: 'demo:nope', rulesetId: 'demo:gone' }), lookup: lookup() });
    expect(missingDuster.ok && missingDuster.value.missing).toEqual(['demo:nope']);
    expect(missingDuster.ok && missingDuster.value.setup.startingCp).toBe(3);
    expect(setupFromRoster({ roster: roster(), lookup: lookup(), scenarioId: 'demo:nope' }).ok).toBe(false);
  });

  it('scenario parts: symmetric scenarios, missing OPFOR cards, side-restricted scoring', () => {
    const sc = lookup().get('scenario', 'demo:lamp-recovery')!;
    const sym = scenarioParts(
      {
        ...sc,
        forces: { symmetric: true, sides: [{ ...sc.forces.sides[0]!, units: [] }, { ...sc.forces.sides[1]!, units: [{ unit: 'demo:nope', count: 1 }] }] },
        scoring: [{ ...sc.scoring[0]!, side: 'choir', max: 2, text: 'per kill' }, { ...sc.scoring[0]!, key: 'other', side: 'unknown' }],
      },
      lookup(),
    );
    expect(sym.missing).toEqual(['demo:nope']);
    expect(sym.opforName).toBe('Choir');
    expect(sym.objectives).toEqual([
      { key: 'kill', label: 'Kill', points: 1, timing: { when: 'immediate' }, max: 2, side: 'opfor', text: 'per kill' },
      { key: 'other', label: 'Kill', points: 1, timing: { when: 'immediate' } },
    ]);
    const solo = scenarioParts({ ...sc, forces: { symmetric: true, sides: [{ ...sc.forces.sides[0]!, units: [] }] } }, lookup());
    expect(solo.opforName).toBeUndefined();
    const playerScoring = scenarioParts({ ...sc, scoring: [{ ...sc.scoring[0]!, side: 'player' }] }, lookup());
    expect(playerScoring.objectives[0]!.side).toBe('player');
  });

  it('models for cards honour modelCount', () => {
    const card = lookup().get('unit', 'demo:lantern-wardens')!;
    expect(modelsForCard({ ...card, modelCount: 2 }).map((m) => m.key)).toEqual(['lamplighter', 'g1']);
    expect(modelsForCard({ ...card, modelCount: 6 })).toHaveLength(6);
  });
});

describe('toAarPrefill', () => {
  it('maps deployed, kills and status per operator; unlinked → undefined', () => {
    const built = setupFromLaunch({ req: launch(), lookup: lookup(), rulesetId: 'demo:house' });
    if (!built.ok) throw new Error(built.error);
    const setup = built.value.setup;
    setup.units![2]!.models[0]!.status = 'reserve'; // ghost never arrives
    const e = createGameEngine();
    e.start(setup);
    must(e, { type: 'creditKill', unit: 'p1', model: 'wren', delta: 2 });
    must(e, { type: 'setModelStatus', unit: 'p1', model: 'moss', status: 'captured' });
    must(e, { type: 'setModelStatus', unit: 'p2', model: 'juno', status: 'destroyed' });
    must(e, { type: 'scoreObjective', objective: 'kill', side: 'player', delta: 2 });
    must(e, { type: 'note', text: 'Wren held the door' });
    must(e, { type: 'endGame' });
    expect(toAarPrefill(e.state)).toEqual({
      campaignSaveId: 'save-1',
      mission: 'recover-lamp',
      operators: {
        wren: { participated: true, kills: 2, status: 'ok' },
        moss: { participated: true, kills: 0, status: 'down' },
        juno: { participated: true, kills: 0, status: 'destroyed' },
        ghost: { participated: false, kills: 0, status: 'ok' },
      },
      rounds: 1,
      notes: 'Final LP: Player 2, Choir 0 after 1 round.\nR1: Wren held the door',
    });
    const unlinked = createGameEngine();
    unlinked.start({ ...setup, link: undefined });
    expect(toAarPrefill(unlinked.state)).toBeUndefined();
  });

  it('observedStatus: damage reads as damaged', () => {
    const m = { status: 'active', damage: { wounds: 1 } } as unknown as ModelState;
    expect(observedStatus(m)).toBe('damaged');
    expect(observedStatus({ ...m, status: 'down' })).toBe('down');
    expect(observedStatus({ ...m, status: 'escaped', damage: {} })).toBe('ok');
  });
});

describe('describeEvent fallbacks', () => {
  it('names unknown units, models, rules, tracks and objectives by key', () => {
    const e = createGameEngine();
    const built = setupFromLaunch({ req: launch(), lookup: lookup() });
    if (!built.ok) throw new Error(built.error);
    e.start(built.value.setup);
    must(e, { type: 'addUnit', side: 'opfor', unit: templateFromContact({ name: 'Lone Scav', models: 1 }) });
    must(e, { type: 'setInitiative', side: null });
    must(e, { type: 'setToken', unit: 'p1', token: 'activated', value: false });
    must(e, { type: 'creditKill', unit: 'o3', model: 'm1', delta: 1 });
    must(e, { type: 'endGame' });
    const s = e.state;
    const ev = (type: string, payload: unknown) => ({ seq: 99, cmd: 99, type, payload }) as GameEvent;
    expect(describeEvent(ev('RuleBoxTicked', { unit: 'zz', rule: 'r', ticked: 1 }), s)).toBe('zz: r 1/?');
    expect(describeEvent(ev('DamageMarked', { unit: 'zz', model: 'm', track: 't', marked: 1 }), s)).toBe('m (zz): t 1/?');
    expect(describeEvent(ev('ObjectiveScored', { objective: 'zz', side: 'opfor', delta: -1 }), s)).toBe('Choir unscored zz');
    expect(describeEvent(ev('CpAdjusted', { side: 'opfor', amount: -2 }), s)).toBe('Choir CP -2');
    expect(gameLog(e.events, s).map((l) => l.text).slice(-4)).toEqual(['Initiative cleared', 'Lantern Wardens (Team Ember): cleared activated', 'Lone Scav kills +1', 'Game ended']);
  });
});
