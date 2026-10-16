import { beforeEach, describe, expect, it } from 'vitest';
import { Condition, CONDITION_OPS, type ConditionOp } from '$lib/packs/schema';
import { evaluate, passes, quantify } from './conditions';
import { ctxFor, feedText, ironEngine, scope } from './__fixtures__/harness';
import type { Ctx, Scope } from './context';
import { createRng } from '../rng/rng';

const covered = new Set<ConditionOp>();
const ev = (ctx: Ctx, raw: unknown, sc: Scope = scope()) => {
  const c = Condition.parse(raw);
  const walk = (x: Condition): void => {
    covered.add(x.op);
    if (x.op === 'all' || x.op === 'any') x.of.forEach(walk);
    if (x.op === 'not') walk(x.cond);
  };
  walk(c);
  return evaluate(ctx, sc, c);
};

let ctx: Ctx;
beforeEach(() => {
  ctx = ctxFor(ironEngine());
});

describe('condition ops', () => {
  it('flag: truthiness and equals', () => {
    expect(ev(ctx, { op: 'flag', flag: 'cp-cut' })).toBe(false); // false is falsy
    expect(ev(ctx, { op: 'flag', flag: 'cp-cut', equals: false })).toBe(true);
    ctx.s.flags.n = 0;
    ctx.s.flags.s = 'go';
    expect([ev(ctx, { op: 'flag', flag: 'n' }), ev(ctx, { op: 'flag', flag: 's' }), ev(ctx, { op: 'flag', flag: 'missing' })]).toEqual([false, true, false]);
  });

  it('trackGte / poolGte (unknown keys are false)', () => {
    ctx.s.tracks.intel!.value = 4;
    expect([ev(ctx, { op: 'trackGte', track: 'intel', value: 4 }), ev(ctx, { op: 'trackGte', track: 'intel', value: 5 }), ev(ctx, { op: 'trackGte', track: 'x', value: -999 })]).toEqual([true, false, false]);
    expect([ev(ctx, { op: 'poolGte', pool: 'supply', value: 6 }), ev(ctx, { op: 'poolGte', pool: 'supply', value: 7 }), ev(ctx, { op: 'poolGte', pool: 'x', value: 0 })]).toEqual([true, false, false]);
  });

  it('missionOutcome: explicit mission, scope mission default, unresolved', () => {
    ctx.s.missions.recon!.outcome = 'failure';
    expect(ev(ctx, { op: 'missionOutcome', mission: 'recon', outcomes: ['failure', 'x'] })).toBe(true);
    expect(ev(ctx, { op: 'missionOutcome', outcomes: ['failure'] }, scope({ mission: 'recon' }))).toBe(true);
    expect(ev(ctx, { op: 'missionOutcome', outcomes: ['failure'] })).toBe(false);
    expect(ev(ctx, { op: 'missionOutcome', mission: 'hunt', outcomes: ['success'] })).toBe(false);
  });

  it('ladderIs: operator scope with quantifiers, team, campaign, unknown ladder', () => {
    ctx.s.operators.vale!.ladders.wounds = 'light';
    const c = (match: string, target = 'team:alpha') => ({ op: 'ladderIs', ladder: 'wounds', target, states: ['light'], match });
    expect([ev(ctx, c('any')), ev(ctx, c('all')), ev(ctx, c('none')), ev(ctx, c('none', 'team:bravo'))]).toEqual([true, false, false, true]);
    expect(ev(ctx, { op: 'ladderIs', ladder: 'wounds', states: ['light'] }, scope({ subject: 'vale' }))).toBe(true);
    expect(ev(ctx, { op: 'ladderIs', ladder: 'readiness', target: 'operator:brook', states: ['green'] })).toBe(true);
    expect(ev(ctx, { op: 'ladderIs', ladder: 'alert', states: ['calm'] })).toBe(true);
    expect(ev(ctx, { op: 'ladderIs', ladder: 'ghost', states: ['x'] })).toBe(false);
    expect(feedText(ctx.s).at(-1)).toBe('Unknown ladder "ghost" in condition');
  });

  it('operatorStat: cmp variants and quantifiers', () => {
    const c = (cmp: string, value: number, match = 'any', target = 'team:alpha') => ({ op: 'operatorStat', target, stat: 'grit', cmp, value, match });
    // alpha grit: vale 3, op-2 2, juno 2
    expect([ev(ctx, c('gte', 3)), ev(ctx, c('gte', 3, 'all')), ev(ctx, c('lte', 2, 'all', 'operator:juno')), ev(ctx, c('eq', 9, 'none'))]).toEqual([true, false, true, true]);
    expect(ev(ctx, c('gte', 0, 'all', 'subject'))).toBe(false); // empty selection
  });

  it('stageIs, roll (seeded), all / any / not', () => {
    expect(ev(ctx, { op: 'stageIs', stage: 'one' })).toBe(true);
    const expected = createRng(ctx.rng.state).die(6) >= 4;
    expect(ev(ctx, { op: 'roll', sides: 6, gte: 4 })).toBe(expected);
    expect(ev(ctx, { op: 'roll', sides: 2, gte: 1 })).toBe(true);
    expect(ev(ctx, { op: 'all', of: [{ op: 'stageIs', stage: 'one' }, { op: 'not', cond: { op: 'stageIs', stage: 'two' } }] })).toBe(true);
    expect(ev(ctx, { op: 'any', of: [{ op: 'stageIs', stage: 'two' }, { op: 'stageIs', stage: 'three' }] })).toBe(false);
  });

  it('hasTag (any listed tag, quantified, filtered target), teamMissions (scope team, current stage), factionIs', () => {
    ctx.s.operators.vale!.tags = ['medic'];
    ctx.s.operators.juno!.tags = ['scout', 'medic'];
    const t = (match: string, target: unknown = 'team:alpha', tags = ['medic']) => ({ op: 'hasTag', target, tags, match });
    expect([ev(ctx, t('any')), ev(ctx, t('all')), ev(ctx, t('none', 'team:bravo')), ev(ctx, t('any', 'roster', ['pilot', 'scout']))]).toEqual([true, false, true, true]);
    const filtered = { from: 'roster', where: { op: 'operatorStat', target: 'subject', stat: 'grit', cmp: 'gte', value: 3 } };
    expect(ev(ctx, t('all', filtered))).toBe(false); // vale (medic, grit 3) + brook (grit 9, no tag)
    expect(ev(ctx, t('all', 'team', ['scout']), scope({ subject: 'juno' }))).toBe(false);

    ctx.s.teamStageMissions = { one: { alpha: 2 }, two: { alpha: 9 } };
    expect(ev(ctx, { op: 'teamMissions', value: 2 }, scope({ team: 'alpha' }))).toBe(true);
    expect(ev(ctx, { op: 'teamMissions', cmp: 'eq', value: 2 }, scope({ subject: 'vale' }))).toBe(true);
    expect(ev(ctx, { op: 'teamMissions', cmp: 'eq', value: 0 }, scope({ team: 'bravo' }))).toBe(true);
    expect(ev(ctx, { op: 'teamMissions', cmp: 'lte', value: 0 })).toBe(true); // no scope team = 0

    expect(ev(ctx, { op: 'factionIs', factions: ['x'] })).toBe(false);
    ctx.s.faction = 'x';
    expect([ev(ctx, { op: 'factionIs', factions: ['y', 'x'] }), ev(ctx, { op: 'factionIs', factions: ['y'] })]).toEqual([true, false]);
  });

  it('helpers: quantify on empty sets, passes on undefined', () => {
    expect([quantify([], 'any', () => true), quantify([], 'all', () => true), quantify([], 'none', () => true)]).toEqual([false, false, true]);
    expect(passes(ctx, scope(), undefined)).toBe(true);
  });

  it('covers every condition op in the DSL', () => {
    expect([...covered].sort()).toEqual([...CONDITION_OPS].sort());
  });
});
