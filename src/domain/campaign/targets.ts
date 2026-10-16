import type { Ladder, Target } from '$lib/packs/schema';
import type { Scope } from './context';
import { activeOperators, activeTeamOperators, type CampaignState } from './state';

// The single implementation of Target resolution (DSL `Target`). Every effect/condition goes through here.

/** `target` absent on a ladder op = `subject` when bound, else `participants`. */
export const defaultTarget = (scope: Scope): Target => (scope.subject ? 'subject' : 'participants');

/** Active operator keys selected by a target, in roster order, de-duplicated. */
export function resolveOperators(s: CampaignState, scope: Scope, target: Target): string[] {
  const active = (k: string | undefined) => (k && s.operators[k]?.status === 'active' ? [k] : []);
  if (target === 'subject') return active(scope.subject);
  if (target === 'roster') return activeOperators(s).map((o) => o.key);
  if (target === 'participants') {
    const set = new Set(scope.participants);
    return activeOperators(s)
      .filter((o) => set.has(o.key))
      .map((o) => o.key);
  }
  if (target.startsWith('operator:')) return active(target.slice('operator:'.length));
  return activeTeamOperators(s, target.slice('team:'.length)).map((o) => o.key);
}

/** Team keys selected by a target: `team:<key>` directly, otherwise the teams of the resolved operators. */
export function resolveTeams(s: CampaignState, scope: Scope, target: Target): string[] {
  if (target.startsWith('team:')) {
    const k = target.slice('team:'.length);
    return s.teams[k] ? [k] : [];
  }
  return [...new Set(resolveOperators(s, scope, target).map((k) => s.operators[k]!.team))];
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
 * Team scope with an implicit target that selects nobody falls back to every team (e.g. an outcome with no participants).
 */
export function resolveLadderSlots(s: CampaignState, scope: Scope, ladder: Ladder, target: Target | undefined): LadderSlot[] {
  if (ladder.scope === 'campaign') {
    return [{ holder: null, get: () => s.ladders[ladder.key], set: (v) => void (s.ladders[ladder.key] = v) }];
  }
  if (ladder.scope === 'team') {
    let teams = resolveTeams(s, scope, target ?? defaultTarget(scope));
    if (teams.length === 0 && target === undefined) teams = [...s.teamOrder];
    return teams.map((t) => ({ holder: t, get: () => s.teams[t]!.ladders[ladder.key], set: (v) => void (s.teams[t]!.ladders[ladder.key] = v) }));
  }
  return resolveOperators(s, scope, target ?? defaultTarget(scope)).map((o) => ({
    holder: o,
    get: () => s.operators[o]!.ladders[ladder.key],
    set: (v) => void (s.operators[o]!.ladders[ladder.key] = v),
  }));
}
