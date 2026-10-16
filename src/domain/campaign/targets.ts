import type { Ladder, Target, TargetSpec } from '$lib/packs/schema';
import type { Ctx, Scope } from './context';
import { activeOperators, activeTeamOperators } from './state';

// The single implementation of target resolution (DSL `TargetSpec`). Every effect/condition goes through here.

/** `target` absent on a ladder op = `subject` when bound, else `participants`. */
export const defaultTarget = (scope: Scope): Target => (scope.subject ? 'subject' : 'participants');

/** Scope team: the forEachTeam loop team, else the subject's team. */
export const scopeTeam = (ctx: Ctx, scope: Scope): string | undefined =>
  scope.team ?? (scope.subject ? ctx.s.operators[scope.subject]?.team : undefined);

function resolveBase(ctx: Ctx, scope: Scope, target: Target): string[] {
  const s = ctx.s;
  const active = (k: string | undefined) => (k && s.operators[k]?.status === 'active' ? [k] : []);
  if (target === 'subject') return active(scope.subject);
  if (target === 'roster') return activeOperators(s).map((o) => o.key);
  if (target === 'participants') {
    const set = new Set(scope.participants);
    return activeOperators(s)
      .filter((o) => set.has(o.key))
      .map((o) => o.key);
  }
  if (target === 'team') {
    const t = scopeTeam(ctx, scope);
    return t ? activeTeamOperators(s, t).map((o) => o.key) : [];
  }
  if (target.startsWith('operator:')) return active(target.slice('operator:'.length));
  return activeTeamOperators(s, target.slice('team:'.length)).map((o) => o.key);
}

/** Active operator keys selected by a target, in roster order. Filters evaluate `where` per operator as `subject`. */
export function resolveOperators(ctx: Ctx, scope: Scope, target: TargetSpec): string[] {
  if (typeof target === 'string') return resolveBase(ctx, scope, target);
  return resolveBase(ctx, scope, target.from).filter((k) => ctx.check({ ...scope, subject: k }, target.where));
}

/** Team keys selected by a target: `team:<key>` / `team` directly, otherwise the teams of the resolved operators. */
export function resolveTeams(ctx: Ctx, scope: Scope, target: TargetSpec): string[] {
  const s = ctx.s;
  if (target === 'team') {
    const t = scopeTeam(ctx, scope);
    return t && s.teams[t] ? [t] : [];
  }
  if (typeof target === 'string' && target.startsWith('team:')) {
    const k = target.slice('team:'.length);
    return s.teams[k] ? [k] : [];
  }
  return [...new Set(resolveOperators(ctx, scope, target).map((k) => s.operators[k]!.team))];
}

/** Where a ladder's state lives for each selected holder. */
export interface LadderSlot {
  /** Operator key, team key, or null for campaign scope. */
  holder: string | null;
  get(): string | undefined;
  set(state: string): void;
}

/**
 * Resolve the ladder slots an op/condition addresses.
 * Team scope: no target inside forEachTeam = the loop team; otherwise an implicit target that selects nobody
 * falls back to every team (e.g. an outcome with no participants).
 */
export function resolveLadderSlots(ctx: Ctx, scope: Scope, ladder: Ladder, target: TargetSpec | undefined): LadderSlot[] {
  const s = ctx.s;
  if (ladder.scope === 'campaign') {
    return [{ holder: null, get: () => s.ladders[ladder.key], set: (v) => void (s.ladders[ladder.key] = v) }];
  }
  if (ladder.scope === 'team') {
    let teams = resolveTeams(ctx, scope, target ?? (scope.team ? 'team' : defaultTarget(scope)));
    if (teams.length === 0 && target === undefined) teams = [...s.teamOrder];
    return teams.map((t) => ({ holder: t, get: () => s.teams[t]!.ladders[ladder.key], set: (v) => void (s.teams[t]!.ladders[ladder.key] = v) }));
  }
  return resolveOperators(ctx, scope, target ?? defaultTarget(scope)).map((o) => ({
    holder: o,
    get: () => s.operators[o]!.ladders[ladder.key],
    set: (v) => void (s.operators[o]!.ladders[ladder.key] = v),
  }));
}
