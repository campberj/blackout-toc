import type { Condition } from '$lib/packs/schema';
import { warn, type Ctx, type Scope } from './context';
import { resolveLadderSlots, resolveOperators, scopeTeam } from './targets';

type Match = 'any' | 'all' | 'none';

/** Quantify over a selection. `all` over an empty selection is false (nobody to satisfy it); `none` is true. */
export function quantify<T>(items: readonly T[], match: Match, pred: (t: T) => boolean): boolean {
  if (match === 'none') return !items.some(pred);
  if (match === 'all') return items.length > 0 && items.every(pred);
  return items.some(pred);
}

const truthy = (v: unknown) => v !== undefined && v !== false && v !== 0 && v !== '';

/** Evaluate a Condition. `roll` draws from the context rng, so evaluation order is part of determinism (left → right, short-circuit). */
export function evaluate(ctx: Ctx, scope: Scope, c: Condition): boolean {
  const s = ctx.s;
  switch (c.op) {
    case 'flag':
      return c.equals === undefined ? truthy(s.flags[c.flag]) : s.flags[c.flag] === c.equals;
    case 'trackGte':
      return (s.tracks[c.track]?.value ?? Number.NEGATIVE_INFINITY) >= c.value;
    case 'poolGte':
      return (s.pools[c.pool] ?? Number.NEGATIVE_INFINITY) >= c.value;
    case 'missionOutcome': {
      const key = c.mission ?? scope.mission;
      const outcome = key ? s.missions[key]?.outcome : null;
      return !!outcome && c.outcomes.includes(outcome);
    }
    case 'ladderIs': {
      const ladder = ctx.campaign.ladders.find((l) => l.key === c.ladder);
      if (!ladder) {
        warn(ctx, `Unknown ladder "${c.ladder}" in condition`);
        return false;
      }
      return quantify(resolveLadderSlots(ctx, scope, ladder, c.target), c.match, (slot) => c.states.includes(slot.get() ?? ''));
    }
    case 'operatorStat':
      return quantify(resolveOperators(ctx, scope, c.target), c.match, (k) => compare(s.operators[k]!.stats[c.stat] ?? 0, c.cmp, c.value));
    case 'hasTag':
      return quantify(resolveOperators(ctx, scope, c.target), c.match, (k) => s.operators[k]!.tags.some((t) => c.tags.includes(t)));
    case 'teamMissions': {
      const team = scopeTeam(ctx, scope);
      const n = team && s.stage ? (s.teamStageMissions[s.stage]?.[team] ?? 0) : 0;
      return compare(n, c.cmp, c.value);
    }
    case 'factionIs':
      return s.faction !== null && c.factions.includes(s.faction);
    case 'stageIs':
      return s.stage === c.stage;
    case 'roll':
      return ctx.rng.die(c.sides) >= c.gte;
    case 'all':
      return c.of.every((x) => evaluate(ctx, scope, x));
    case 'any':
      return c.of.some((x) => evaluate(ctx, scope, x));
    case 'not':
      return !evaluate(ctx, scope, c.cond);
  }
}

export const compare = (a: number, cmp: 'gte' | 'lte' | 'eq', b: number) => (cmp === 'gte' ? a >= b : cmp === 'lte' ? a <= b : a === b);

/** Absent condition = pass. */
export const passes = (ctx: Ctx, scope: Scope, c: Condition | undefined) => c === undefined || evaluate(ctx, scope, c);
