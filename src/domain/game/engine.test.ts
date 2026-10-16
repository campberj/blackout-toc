import { describe, expect, it } from 'vitest';
import { builtSetup, must, startedEngine } from './__fixtures__/game';
import {
  createGameEngine,
  dueObjectives,
  gameLog,
  replayGame,
  score,
  templateFromContact,
  timingText,
  validateGameEvent,
  type GameEngine,
  type GameEvent,
} from './index';

/** Scripted two-round game touching every command type. */
function script(e: GameEngine) {
  must(e, { type: 'setInitiative', side: 'player' });
  must(e, { type: 'setPhase', phase: 'execution' });
  must(e, { type: 'useDrill', unit: 'p2' }); // 1 CP
  must(e, { type: 'setToken', unit: 'p2', token: 'activated', value: true });
  must(e, { type: 'setLoads', unit: 'p2', used: 1, model: 'lamplighter' });
  must(e, { type: 'setRuleBoxes', unit: 'p2', rule: 'lamplighter/glow', ticked: 1 });
  must(e, { type: 'setToken', unit: 'p2', model: 'g1', token: 'engaged', value: true });
  must(e, { type: 'setModelStatus', unit: 'o1', model: 'g1', status: 'destroyed' });
  must(e, { type: 'creditKill', unit: 'p2', model: 'g1' });
  must(e, { type: 'scoreObjective', objective: 'kill', side: 'player' });
  must(e, { type: 'spendCp', side: 'opfor', reason: 'chained-activation' });
  must(e, { type: 'setDamage', unit: 'p1', model: 'g1', track: 'wounds', marked: 1 });
  must(e, { type: 'setToken', unit: 'o2', token: 'pinned', value: true });
  must(e, { type: 'addUnit', side: 'opfor', unit: templateFromContact({ name: 'Scav Pack', models: 3, track: { name: 'Hits', size: 2 } }) });
  must(e, { type: 'note', text: 'Hulk went down to the hook' });
  must(e, { type: 'advanceRound', force: true }); // 2 units idle → warning only
  must(e, { type: 'setModelStatus', unit: 'p2', model: 'g2', status: 'down' });
  must(e, { type: 'scoreObjective', objective: 'hold-lamp', side: 'opfor' });
  must(e, { type: 'adjustVp', side: 'player', amount: 2 });
  must(e, { type: 'adjustCp', side: 'player', amount: 1 });
  must(e, { type: 'adjustBurnCards', side: 'opfor', amount: 2 });
  must(e, { type: 'addObjective', label: 'Recover the ledger', points: 3, side: 'player', max: 1 });
  must(e, { type: 'scoreObjective', objective: 'custom-1', side: 'player' });
}

describe('setup from roster + scenario + ruleset', () => {
  it('snapshots player units, scenario OPFOR, objectives, caps and labels', () => {
    const { setup, missing } = builtSetup();
    expect(missing).toEqual([]);
    expect(setup).toMatchObject({
      name: 'Ember Team',
      rulesetId: 'demo:house',
      rosterId: 'r1',
      scenarioId: 'demo:lamp-recovery',
      scenarioName: 'Lamp Recovery',
      roundLimit: 5,
      startingCp: 3,
      cpCaps: { 'chained-activation': 1 },
      scoreLabel: 'LP',
      sides: { player: { name: 'Ember Team' }, opfor: { name: 'Choir' } },
      specialRules: [{ key: 'dim-light', name: 'Dim Light', text: 'Invented.' }],
    });
    expect(setup.units!.map((u) => [u.key, u.side, u.name, u.models.map((m) => m.name)])).toEqual([
      ['p1', 'player', 'Warden Captain', ['Warden Captain']],
      ['p2', 'player', 'Lantern Wardens', ['Lamplighter', 'Grunt 1', 'Grunt 2', 'Grunt 3']],
      ['o1', 'opfor', 'Choir Hulk 1', ['Choir Hulk']],
      ['o2', 'opfor', 'Choir Hulk 2', ['Choir Hulk']],
    ]);
    expect(setup.units![1]).toMatchObject({
      forceId: 'demo:lantern-detachment',
      combatLoads: 1,
      rules: [
        { key: 'steady', name: 'Steady', usesMax: 2 },
        { key: 'lamplighter/glow', name: 'Lamplighter: Glow', usesMax: 1 },
      ],
    });
    expect(setup.objectives![1]).toEqual({ key: 'hold-lamp', label: 'Hold the lamp', points: 2, timing: { when: 'end-of-round', rounds: [2, 4] } });
  });
});

describe('golden: scripted game', () => {
  it('commands → expected state', () => {
    const e = startedEngine();
    script(e);
    const s = e.state;
    expect(s).toMatchObject({ round: 2, phase: 'operations', initiative: null, ended: false });
    expect(s.sides.player).toMatchObject({ cp: 3, vpAdjust: 2, capUses: {} }); // 3 − 1 drill + 1
    expect(s.sides.opfor).toMatchObject({ cp: 2, burnCards: 2, capUses: {} });
    const p2 = s.units[1]!;
    expect(p2).toMatchObject({ activated: false, drillUsed: false, loadsUsed: 1, ruleUses: { 'lamplighter/glow': 1 } });
    expect(p2.models[1]).toMatchObject({ kills: 1, engaged: false, status: 'active' });
    expect(p2.models[2]).toMatchObject({ status: 'down', deployed: true });
    expect(s.units[0]!.models[0]!.damage).toEqual({ wounds: 1 });
    expect(s.units[2]!.models[0]!.status).toBe('destroyed');
    expect(s.units[3]!.pinned).toBe(false); // cleared by the new round
    expect(s.units[4]).toMatchObject({ key: 'o3', side: 'opfor', name: 'Scav Pack', tracks: [{ key: 'damage', name: 'Hits', size: 2 }] });
    expect(s.units[4]!.models.map((m) => m.name)).toEqual(['Scav Pack 1', 'Scav Pack 2', 'Scav Pack 3']);
    expect(score(s, 'player')).toBe(1 + 2 + 3);
    expect(score(s, 'opfor')).toBe(2);
    expect(s.notes).toEqual([{ seq: expect.any(Number), round: 1, text: 'Hulk went down to the hook' }]);
    expect(dueObjectives(s).map((o) => o.key)).toEqual(['hold-lamp']);
    expect(e.events.map((x) => x.type)).toMatchSnapshot();
  });

  it('replay equals live state; the log describes every event', () => {
    const e = startedEngine();
    script(e);
    expect(replayGame(e.events)).toEqual(e.state);
    const fresh = createGameEngine();
    expect(fresh.load(e.events.map(({ cmd: _c, ...x }) => x) as never)).toMatchObject({ ok: true }); // eslint-disable-line @typescript-eslint/no-unused-vars
    const log = gameLog(e.events, e.state);
    expect(log.map((l) => l.text)).toMatchSnapshot();
    expect(log.at(-1)!.round).toBe(2);
    expect(log[0]!.at).toBe('2026-10-16T12:00:00.000Z');
  });
});

describe('undo is per command', () => {
  it('removes both events of a drill, never the start', () => {
    const e = startedEngine();
    must(e, { type: 'useDrill', unit: 'p2', cp: 2 });
    expect(e.events.slice(-2).map((x) => x.type)).toEqual(['DrillUsed', 'CpSpent']);
    expect(e.state.sides.player.cp).toBe(1);
    expect(e.undo()).toBe(true);
    expect(e.state.sides.player.cp).toBe(3);
    expect(e.state.units[1]!.drillUsed).toBe(false);
    expect(e.undo()).toBe(false);
    expect(e.events).toHaveLength(1);
    expect(createGameEngine().undo()).toBe(false);
  });
});

describe('caps and validation', () => {
  it('per-round CP caps block (overridable) and reset on a new round', () => {
    const e = startedEngine();
    must(e, { type: 'spendCp', side: 'player', reason: 'chained-activation' });
    const r = e.dispatch({ type: 'spendCp', side: 'player', reason: 'chained-activation' });
    expect(r).toMatchObject({ ok: false, error: { message: 'Chained Activation is limited to 1 per round', overridable: true } });
    expect(e.dispatch({ type: 'spendCp', side: 'player', reason: 'chained-activation', force: true }).ok).toBe(true);
    expect(e.state.sides.player).toMatchObject({ cp: 1, capUses: { 'chained-activation': 2 } });
    must(e, { type: 'advanceRound', force: true });
    expect(e.state.sides.player.capUses).toEqual({});
    expect(e.dispatch({ type: 'spendCp', side: 'player', reason: 'chained-activation' }).ok).toBe(true);
    expect(e.dispatch({ type: 'spendCp', side: 'player', amount: 2 })).toMatchObject({ ok: false, error: { overridable: false } });
    must(e, { type: 'adjustCp', side: 'player', amount: 1 });
    must(e, { type: 'spendCp', side: 'player', reason: 'anything' }); // uncapped reason
    expect(e.state.sides.player.capUses).toEqual({ 'chained-activation': 1 });
  });

  it('capMode warn turns cap hits into warnings', () => {
    const e = createGameEngine();
    e.start({ ...builtSetup().setup, capMode: 'warn' });
    must(e, { type: 'spendCp', side: 'opfor', reason: 'chained-activation' });
    const r = e.dispatch({ type: 'spendCp', side: 'opfor', reason: 'chained-activation' });
    expect(r.ok && r.value.warnings.map((w) => w.code)).toEqual(['cp-cap']);
  });

  it('round limit, drills, warnings and lifecycle', () => {
    const e = startedEngine();
    expect(e.dispatch({ type: 'advanceRound' })).toMatchObject({ ok: true, value: { warnings: [{ code: 'not-activated' }] } });
    for (let i = 0; i < 3; i++) must(e, { type: 'advanceRound' });
    expect(e.check({ type: 'advanceRound' }).map((i) => i.code)).toEqual(['round-limit', 'not-activated']);
    expect(e.dispatch({ type: 'advanceRound' })).toMatchObject({ ok: false, error: { overridable: true } });
    must(e, { type: 'setToken', unit: 'p2', token: 'activated', value: true });
    const d = e.dispatch({ type: 'useDrill', unit: 'p2' });
    expect(d.ok && d.value.warnings.map((w) => w.code)).toEqual(['drill-activated']);
    expect(e.dispatch({ type: 'useDrill', unit: 'p2' })).toMatchObject({ ok: false, error: { overridable: true } });
    const nf = e.dispatch({ type: 'useDrill', unit: 'o1', cp: 0 });
    expect(nf.ok && nf.value.warnings.map((w) => w.code)).toEqual(['no-force']);
    expect(e.check({ type: 'startGame', setup: builtSetup().setup })[0]!.code).toBe('started');
    must(e, { type: 'endGame' });
    expect(e.dispatch({ type: 'adjustVp', side: 'player', amount: 1 })).toMatchObject({ ok: false, error: { message: expect.stringMatching(/ended/) } });
    expect(e.dispatch({ type: 'note', text: 'post-game' }).ok).toBe(true);
    expect(createGameEngine().check({ type: 'note', text: 'x' })[0]!.code).toBe('not-started');
  });

  it('early end warns', () => {
    const r = startedEngine().dispatch({ type: 'endGame' });
    expect(r.ok && r.value.warnings[0]!.code).toBe('early-end');
  });

  it.each([
    [{ type: 'setLoads', unit: 'p2', used: 2 }, 'loads-max'],
    [{ type: 'setLoads', unit: 'p2', used: 1, model: 'zz' }, 'unknown-model'],
    [{ type: 'setLoads', unit: 'zz', used: 0 }, 'unknown-unit'],
    [{ type: 'setRuleBoxes', unit: 'p2', rule: 'steady', ticked: 3 }, 'rule-max'],
    [{ type: 'setRuleBoxes', unit: 'p2', rule: 'nope', ticked: 1 }, 'unknown-rule'],
    [{ type: 'setDamage', unit: 'p1', model: 'g1', track: 'wounds', marked: 3 }, 'track-max'],
    [{ type: 'setDamage', unit: 'p1', model: 'g1', track: 'nope', marked: 1 }, 'unknown-track'],
    [{ type: 'setDamage', unit: 'p1', model: 'zz', track: 'wounds', marked: 1 }, 'unknown-model'],
    [{ type: 'setToken', unit: 'p2', token: 'ready', value: true }, 'model-required'],
    [{ type: 'setToken', unit: 'p2', model: 'g1', token: 'pinned', value: true }, 'unit-token'],
    [{ type: 'setToken', unit: 'p2', model: 'zz', token: 'ready', value: true }, 'unknown-model'],
    [{ type: 'creditKill', unit: 'p2', model: 'g1', delta: -1 }, 'kills-min'],
    [{ type: 'scoreObjective', objective: 'nope', side: 'player' }, 'unknown-objective'],
    [{ type: 'scoreObjective', objective: 'kill', side: 'player', delta: -1 }, 'objective-min'],
    [{ type: 'useDrill', unit: 'p2', cp: 4 }, 'cp-short'],
    [{ type: 'setPhase', phase: 'night' }, 'invalid'],
  ])('blocks %o (%s)', (cmd, code) => {
    const e = startedEngine();
    const r = e.dispatch(cmd as never);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.issues.map((i) => i.code)).toContain(code);
    expect(e.events).toHaveLength(1);
  });

  it('objective side and max', () => {
    const e = startedEngine();
    must(e, { type: 'addObjective', label: 'Flag', points: 1, side: 'opfor', max: 1 });
    expect(e.dispatch({ type: 'scoreObjective', objective: 'custom-1', side: 'player' })).toMatchObject({ ok: false, error: { message: 'Only Choir scores Flag' } });
    must(e, { type: 'scoreObjective', objective: 'custom-1', side: 'opfor' });
    expect(e.dispatch({ type: 'scoreObjective', objective: 'custom-1', side: 'opfor' })).toMatchObject({ ok: false, error: { issues: [{ code: 'objective-max' }] } });
  });

  it('damage on a model that is out warns; reserve models are not deployed until they arrive', () => {
    const e = startedEngine();
    must(e, { type: 'setModelStatus', unit: 'p1', model: 'g1', status: 'destroyed' });
    const r = e.dispatch({ type: 'setDamage', unit: 'p1', model: 'g1', track: 'wounds', marked: 2 });
    expect(r.ok && r.value.warnings[0]!.code).toBe('model-out');
    const f = createGameEngine();
    const setup = builtSetup(false).setup;
    setup.units![0]!.models[0]!.status = 'reserve';
    f.start(setup);
    expect(f.state.units[0]!.models[0]!.deployed).toBe(false);
    must(f, { type: 'setModelStatus', unit: 'p1', model: 'g1', status: 'reserve' });
    expect(f.state.units[0]!.models[0]!.deployed).toBe(false);
    must(f, { type: 'setModelStatus', unit: 'p1', model: 'g1', status: 'active' });
    expect(f.state.units[0]!.models[0]!.deployed).toBe(true);
  });

  it('limits: units, objectives, round 99', () => {
    const e = createGameEngine();
    const setup = builtSetup(false).setup;
    e.start({ ...setup, roundLimit: 1, units: Array.from({ length: 64 }, (_, i) => ({ ...setup.units![0]!, key: `p${i + 1}` })) });
    expect(e.check({ type: 'addUnit', side: 'opfor', unit: templateFromContact({ name: 'X', models: 1 }) })[0]!.code).toBe('unit-limit');
    for (let i = 0; i < 48; i++) must(e, { type: 'addObjective', label: `O${i}`, points: 1 });
    expect(e.check({ type: 'addObjective', label: 'one more', points: 1 })[0]!.code).toBe('objective-limit');
    for (let i = 1; i < 99; i++) must(e, { type: 'advanceRound', force: true });
    expect(e.dispatch({ type: 'advanceRound', force: true })).toMatchObject({ ok: false, error: { overridable: false } });
  });
});

describe('load and events', () => {
  it('validates payloads and the first event', () => {
    const e = startedEngine();
    must(e, { type: 'note', text: 'x' });
    const events = [...e.events];
    expect(createGameEngine().load([events[1]!] as never)).toMatchObject({ ok: false, error: 'A game log must begin with GameStarted' });
    expect(createGameEngine().load([{ ...events[0]!, type: 'Bogus' }] as never)).toMatchObject({ ok: false, error: 'Unknown event type "Bogus"' });
    expect(createGameEngine().load([events[0]!, { ...events[1]!, payload: { text: '' } }] as never)).toMatchObject({ ok: false });
    expect(createGameEngine().load([events[0]!, { ...events[1]!, seq: 9 }] as never)).toMatchObject({ ok: false });
    expect(createGameEngine().load([]).ok).toBe(true);
    expect(validateGameEvent({ seq: 1, type: 'GameEnded', payload: {} })).toBeUndefined();
  });

  it('reducer ignores model tokens without a model and unknown event types', () => {
    const e = startedEngine();
    const s = e.state;
    const bogus = [...e.events, { seq: 2, cmd: 2, type: 'TokenSet', payload: { unit: 'p2', token: 'ready', value: true } } as GameEvent];
    expect(replayGame(bogus)).toEqual(s);
    expect(replayGame([...e.events, { seq: 2, cmd: 2, type: 'Nope', payload: {} } as unknown as GameEvent])).toEqual(s);
  });
});

describe('timing reminders', () => {
  it.each([
    [{ when: 'immediate' }, null],
    [{ when: 'immediate', rounds: [3] }, 'Score during R3'],
    [{ when: 'end-of-game' }, 'Score at end of game'],
    [{ when: 'end-of-round' }, 'Score at end of each round'],
    [{ when: 'end-of-round', rounds: [2, 4] }, 'Score at end of R2, R4'],
  ] as const)('%o → %s', (timing, text) => expect(timingText({ timing: timing as never })).toBe(text));

  it('end-of-game objectives come due in the last round', () => {
    const e = startedEngine(false);
    must(e, { type: 'addObjective', label: 'x', points: 1 });
    const s = { ...e.state, objectives: [{ ...e.state.objectives[0]!, timing: { when: 'end-of-game' as const } }] };
    expect(dueObjectives(s)).toEqual([]);
    expect(dueObjectives({ ...s, round: 5 })).toHaveLength(1);
    expect(dueObjectives({ ...s, objectives: [{ ...s.objectives[0]!, timing: { when: 'end-of-round' } }] })).toHaveLength(1);
  });
});
