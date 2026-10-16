import { beforeEach, describe, expect, it } from 'vitest';
import { Effect, EFFECT_OPS, type EffectOp } from '$lib/packs/schema';
import { applyEffects } from './effects';
import { ctxFor, feedText, ironEngine, scope } from './__fixtures__/harness';
import type { Ctx, Scope } from './context';

const covered = new Set<EffectOp>();
const run = (ctx: Ctx, sc: Scope, ...raw: unknown[]) => {
  const effects = raw.map((r) => Effect.parse(r));
  effects.forEach((e) => covered.add(e.op));
  applyEffects(ctx, sc, effects);
};
const op = (ctx: Ctx, k: string) => ctx.s.operators[k]!;

let ctx: Ctx;
const all = () => scope({ participants: ['vale', 'op-2', 'juno', 'brook'] });
beforeEach(() => {
  ctx = ctxFor(ironEngine());
});

describe('effect ops', () => {
  it('addXp targets participants/roster/subject/operator/team and auto-promotes', () => {
    run(ctx, scope({ participants: ['vale', 'brook'] }), { op: 'addXp', target: 'participants', amount: 5 });
    expect([op(ctx, 'vale').stats.xp, op(ctx, 'brook').stats.xp, op(ctx, 'juno').stats.xp]).toEqual([5, 5, 0]);
    expect(op(ctx, 'vale').rank).toBe('cpl');
    run(ctx, scope(), { op: 'addXp', target: 'roster', amount: 1 }, { op: 'addXp', target: 'team:bravo', amount: 1 });
    run(ctx, scope({ subject: 'juno' }), { op: 'addXp', target: 'subject', amount: 2 }, { op: 'addXp', target: 'operator:juno', amount: 10 });
    expect([op(ctx, 'brook').stats.xp, op(ctx, 'juno').stats.xp, op(ctx, 'juno').rank]).toEqual([7, 13, 'sgt']);
    run(ctx, scope(), { op: 'addXp', target: 'subject', amount: 1 }, { op: 'addXp', target: 'operator:ghost', amount: 1 }, { op: 'addXp', target: 'team:ghost', amount: 1 });
    expect(op(ctx, 'vale').stats.xp).toBe(6);
    run(ctx, scope(), { op: 'addXp', target: 'operator:juno', amount: -99 });
    expect(op(ctx, 'juno').stats.xp).toBe(0); // built-ins floor at 0
    expect(op(ctx, 'juno').rank).toBe('sgt'); // never auto-demotes
  });

  it('adjustStat clamps to StatDef bounds and rejects unknown stats', () => {
    run(ctx, scope(), { op: 'adjustStat', target: 'operator:vale', stat: 'grit', amount: 10 });
    expect(op(ctx, 'vale').stats.grit).toBe(5);
    run(ctx, scope(), { op: 'adjustStat', target: 'operator:vale', stat: 'grit', amount: -10 }, { op: 'adjustStat', target: 'roster', stat: 'kills', amount: 2 });
    expect(op(ctx, 'vale').stats).toMatchObject({ grit: 0, kills: 2 });
    run(ctx, scope(), { op: 'adjustStat', target: 'roster', stat: 'nope', amount: 1 });
    expect(feedText(ctx.s).at(-1)).toBe('Unknown stat "nope"');
  });

  it('stepLadder clamps, runs transitions + onEnter (KIA chain), default target = subject else participants', () => {
    run(ctx, scope({ subject: 'vale' }), { op: 'stepLadder', ladder: 'wounds', steps: 1 });
    expect(op(ctx, 'vale').ladders.wounds).toBe('light');
    expect(op(ctx, 'vale').stats.grit).toBe(2); // ok→light transition: 3 - 1
    run(ctx, scope({ participants: ['juno'] }), { op: 'stepLadder', ladder: 'wounds', steps: -4 });
    expect(op(ctx, 'juno').ladders.wounds).toBe('ok');
    const supply = ctx.s.pools.supply!;
    run(ctx, scope(), { op: 'stepLadder', ladder: 'wounds', target: 'operator:juno', steps: 16 });
    expect(op(ctx, 'juno')).toMatchObject({ status: 'removed', removal: { reason: 'kia', seq: 99 } });
    expect(ctx.s.pools.supply).toBe(supply - 1); // onOperatorKia trigger
    expect(feedText(ctx.s)).toContain('Juno () is gone. Team Alpha has 2 left.');
    run(ctx, scope(), { op: 'stepLadder', ladder: 'nope', steps: 1 });
    expect(feedText(ctx.s).at(-1)).toBe('Unknown ladder "nope"');
  });

  it('setLadder on team scope (by operator → team, by team, implicit → all teams) and campaign scope', () => {
    run(ctx, scope(), { op: 'setLadder', ladder: 'readiness', target: 'operator:brook', state: 'amber' });
    expect([ctx.s.teams.alpha!.ladders.readiness, ctx.s.teams.bravo!.ladders.readiness]).toEqual(['green', 'amber']);
    const supply = ctx.s.pools.supply!;
    run(ctx, scope(), { op: 'setLadder', ladder: 'readiness', target: 'team:alpha', state: 'red' });
    expect(ctx.s.pools.supply).toBe(supply - 1); // red onEnter
    run(ctx, scope(), { op: 'stepLadder', ladder: 'readiness', steps: -1 });
    expect([ctx.s.teams.alpha!.ladders.readiness, ctx.s.teams.bravo!.ladders.readiness]).toEqual(['amber', 'green']);
    run(ctx, scope({ subject: 'vale' }), { op: 'setLadder', ladder: 'alert', state: 'blackout' }, { op: 'setLadder', ladder: 'alert', state: 'blackout' });
    expect(ctx.s.ladders.alert).toBe('blackout');
    run(ctx, scope(), { op: 'setLadder', ladder: 'alert', state: 'bogus' });
    expect(feedText(ctx.s).at(-1)).toMatch(/Unknown state "bogus"/);
  });

  it('adjustPool clamps to min/max; adjustTrack fires milestones (once vs repeat) in order', () => {
    run(ctx, scope(), { op: 'adjustPool', pool: 'supply', amount: 99 });
    expect(ctx.s.pools.supply).toBe(8);
    run(ctx, scope(), { op: 'adjustPool', pool: 'supply', amount: -99 }, { op: 'adjustPool', pool: 'ghost', amount: 1 });
    expect(ctx.s.pools.supply).toBe(0);
    run(ctx, scope(), { op: 'adjustTrack', track: 'intel', amount: 7 });
    expect(ctx.s.tracks.intel).toEqual({ value: 7, fired: ['m3', 'm6'] });
    expect(ctx.s.flags['intel-3']).toBe(true);
    expect(ctx.s.teams.alpha!.assets.uav).toBe(1);
    expect(ctx.s.pools.supply).toBe(1);
    run(ctx, scope(), { op: 'adjustTrack', track: 'intel', amount: -5 }, { op: 'adjustTrack', track: 'intel', amount: 5 });
    expect(ctx.s.teams.alpha!.assets.uav).toBe(1); // m3 once
    expect(ctx.s.pools.supply).toBe(2); // m6 repeats
    run(ctx, scope(), { op: 'adjustTrack', track: 'intel', amount: 99 }, { op: 'adjustTrack', track: 'intel', amount: 1 }, { op: 'adjustTrack', track: 'ghost', amount: 1 });
    expect(ctx.s.tracks.intel!.value).toBe(12);
    expect(ctx.s.flags.breakthrough).toBe(true);
    expect(feedText(ctx.s).at(-1)).toBe('Unknown track "ghost"');
  });

  it('setFlag (default true and explicit scalar)', () => {
    run(ctx, scope(), { op: 'setFlag', flag: 'a' }, { op: 'setFlag', flag: 'b', value: 'yes' });
    expect(ctx.s.flags).toMatchObject({ a: true, b: 'yes' });
  });

  it('addOperator: rolls name, applies defaults; full/missing team → pending choice', () => {
    run(ctx, scope(), { op: 'addOperator', team: 'bravo', operator: { key: 'vale', callsign: 'DUP' } });
    const added = ctx.s.teams.bravo!.operators.at(-1)!;
    expect(added).toMatch(/^vale-\d+$/); // key collision → suffixed
    expect(op(ctx, added)).toMatchObject({ callsign: 'DUP', rank: 'pvt', fields: { kit: 'standard' }, ladders: { wounds: 'ok' }, stats: { grit: 2 } });
    expect(op(ctx, added).name).not.toMatch(/^Operator/);
    run(ctx, scope(), { op: 'addOperator', team: 'alpha', operator: { name: 'Extra' } }, { op: 'addOperator', team: 'ghost', operator: {} });
    expect(ctx.s.pending.map((p) => [p.key, p.team, p.operator.name !== undefined])).toEqual([
      ['choice-1', 'alpha', true],
      ['choice-2', 'ghost', true],
    ]);
  });

  it('removeOperator (non-KIA does not fire onOperatorKia; already removed is skipped)', () => {
    const supply = ctx.s.pools.supply!;
    run(ctx, scope(), { op: 'removeOperator', target: 'team:alpha', reason: 'mia' }, { op: 'removeOperator', target: 'operator:vale', reason: 'kia' });
    expect(['vale', 'op-2', 'juno'].map((k) => op(ctx, k).removal?.reason)).toEqual(['mia', 'mia', 'mia']);
    expect(ctx.s.pools.supply).toBe(supply);
  });

  it('addTeam respects teamsMax and duplicates; seeded operators join', () => {
    run(ctx, scope(), { op: 'addTeam', team: { key: 'delta', name: 'Delta', operators: [{ name: 'D1' }] } });
    expect(ctx.s.teamOrder).toEqual(['alpha', 'bravo', 'delta']);
    expect(op(ctx, ctx.s.teams.delta!.operators[0]!).name).toBe('D1');
    run(ctx, scope(), { op: 'addTeam', team: { key: 'alpha', name: 'Dup' } }, { op: 'addTeam', team: { key: 'echo', name: 'Echo' } });
    expect(feedText(ctx.s).slice(-2)).toEqual(['Team "alpha" already exists', 'Team limit (3) reached; Echo not added']);
  });

  it('unlockMission (with stage placement) / lockMission', () => {
    run(ctx, scope(), { op: 'unlockMission', mission: 'bonus', stage: 'two' });
    expect(ctx.s.missions.bonus).toMatchObject({ status: 'available', stage: 'two' });
    run(ctx, scope(), { op: 'lockMission', mission: 'bonus' }, { op: 'lockMission', mission: 'ghost' }, { op: 'unlockMission', mission: 'ghost' });
    expect(ctx.s.missions.bonus!.status).toBe('locked');
    run(ctx, scope(), { op: 'unlockMission', mission: 'bonus', stage: 'nowhere' });
    expect(feedText(ctx.s).at(-1)).toBe('Unknown stage "nowhere"');
  });

  it('rollTable: weighted, filter-aware, when-aware, times, neutral fallback, unknown table', () => {
    run(ctx, scope(), { op: 'rollTable', table: 'rumors', times: 5 });
    const rolled = ctx.s.feed.filter((f) => f.source.type === 'table' && f.kind === 'system').map((f) => f.text);
    expect(rolled).toHaveLength(5);
    expect(rolled.every((t) => /Rumors: (Whisper|Stash)\./.test(t))).toBe(true); // grim filtered, late gated by stage
    run(ctx, scope(), { op: 'rollTable', table: 'grim-only' });
    expect(ctx.s.feed.at(-1)).toMatchObject({ kind: 'narrative', title: 'Grim Only', text: 'Nothing of note occurs.' });
    run(ctx, scope(), { op: 'rollTable', table: 'demo:night-events' }, { op: 'rollTable', table: 'nope' });
    expect(feedText(ctx.s).at(-1)).toBe('Unknown table "nope"');
  });

  it('showNarrative: key, inline, unknown key', () => {
    run(ctx, scope({ subject: 'vale' }), { op: 'showNarrative', narrative: 'kia-note' }, { op: 'showNarrative', narrative: { text: 'Hi {{operator.callsign}}' } });
    expect(feedText(ctx.s).slice(-2)).toEqual(['Vale (KNIFE) is gone. Team Alpha has 3 left.', 'Hi KNIFE']);
    run(ctx, scope(), { op: 'showNarrative', narrative: 'ghost' });
    expect(feedText(ctx.s).at(-1)).toBe('Unknown narrative "ghost"');
  });

  it('grantAsset: campaign / team / unknown asset / unknown team', () => {
    run(ctx, scope(), { op: 'grantAsset', asset: 'uav', count: 2 }, { op: 'grantAsset', asset: 'uav', team: 'bravo' });
    expect([ctx.s.assets.uav, ctx.s.teams.bravo!.assets.uav]).toEqual([2, 1]);
    run(ctx, scope(), { op: 'grantAsset', asset: 'tank' }, { op: 'grantAsset', asset: 'uav', team: 'ghost' });
    expect(feedText(ctx.s).slice(-2)).toEqual(['Unknown asset "tank"', 'Unknown team "ghost"']);
  });

  it('promote: next rank, explicit rank, top of ladder, unknown rank', () => {
    run(ctx, scope(), { op: 'promote', target: 'operator:vale' });
    expect(op(ctx, 'vale').rank).toBe('cpl');
    run(ctx, scope(), { op: 'promote', target: 'operator:vale', rank: 'lt' }, { op: 'promote', target: 'operator:vale' });
    expect(op(ctx, 'vale').rank).toBe('lt');
    run(ctx, scope(), { op: 'promote', target: 'roster', rank: 'general' });
    expect(feedText(ctx.s).at(-1)).toBe('Unknown rank "general"');
  });

  it('if: then / else / no else', () => {
    run(ctx, all(), {
      op: 'if',
      cond: { op: 'flag', flag: 'cp-cut', equals: false },
      then: [{ op: 'setFlag', flag: 'then' }],
      else: [{ op: 'setFlag', flag: 'else' }],
    });
    run(ctx, all(), { op: 'if', cond: { op: 'stageIs', stage: 'two' }, then: [{ op: 'setFlag', flag: 'x' }], else: [{ op: 'setFlag', flag: 'else2' }] });
    run(ctx, all(), { op: 'if', cond: { op: 'stageIs', stage: 'two' }, then: [{ op: 'setFlag', flag: 'y' }] });
    expect(ctx.s.flags).toMatchObject({ then: true, else2: true });
    expect(ctx.s.flags).not.toHaveProperty('else');
    expect(ctx.s.flags).not.toHaveProperty('y');
  });

  it('covers every effect op in the DSL', () => {
    expect([...covered].sort()).toEqual([...EFFECT_OPS].sort());
  });
});
