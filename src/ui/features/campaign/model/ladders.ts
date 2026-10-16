import type { Campaign, Ladder } from '$lib/packs/schema';
import type { CampaignState, OperatorState, TeamState } from '$lib/domain/campaign';

// Ladder state → badge. Tone is positional: ladders are ordered best → worst (DESIGN §6).

export type Tone = 'ok' | 'warn' | 'crit' | 'neutral';

export interface LadderBadge {
  ladder: string;
  ladderName: string;
  state: string;
  label: string;
  tone: Tone;
  /** At the ladder's initial state (nothing to report). */
  initial: boolean;
}

/** First state ok, worst third crit, anything between warn. */
export function ladderTone(ladder: Ladder, stateKey: string): Tone {
  const i = ladder.states.findIndex((s) => s.key === stateKey);
  if (i < 0) return 'neutral';
  if (i === 0) return 'ok';
  return i / (ladder.states.length - 1) > 0.6 ? 'crit' : 'warn';
}

export function ladderBadge(ladder: Ladder, stateKey: string): LadderBadge {
  return {
    ladder: ladder.key,
    ladderName: ladder.name,
    state: stateKey,
    label: ladder.states.find((s) => s.key === stateKey)?.name ?? stateKey,
    tone: ladderTone(ladder, stateKey),
    initial: stateKey === ladder.initial,
  };
}

const scoped = (campaign: Campaign, scope: Ladder['scope']) => campaign.ladders.filter((l) => l.scope === scope);

/** Every operator-scope ladder, in pack order. */
export const operatorLadders = (campaign: Campaign, op: OperatorState): LadderBadge[] =>
  scoped(campaign, 'operator').flatMap((l) => (op.ladders[l.key] === undefined ? [] : [ladderBadge(l, op.ladders[l.key]!)]));

/**
 * Badges worth showing on a roster row: ladders off their initial state; if none, the first
 * ladder's state so the row still reads "Fit for duty" rather than nothing.
 */
export function operatorBadges(campaign: Campaign, op: OperatorState): LadderBadge[] {
  const all = operatorLadders(campaign, op);
  const off = all.filter((b) => !b.initial);
  return off.length ? off : all.slice(0, 1);
}

export const teamBadges = (campaign: Campaign, team: TeamState): LadderBadge[] =>
  scoped(campaign, 'team').flatMap((l) => (team.ladders[l.key] === undefined ? [] : [ladderBadge(l, team.ladders[l.key]!)]));

export const campaignBadges = (campaign: Campaign, s: CampaignState): LadderBadge[] =>
  scoped(campaign, 'campaign').flatMap((l) => (s.ladders[l.key] === undefined ? [] : [ladderBadge(l, s.ladders[l.key]!)]));

const RANK: Record<Tone, number> = { neutral: 0, ok: 1, warn: 2, crit: 3 };

/** Worst tone among badges (team readiness summary). */
export const worstTone = (badges: readonly LadderBadge[]): Tone =>
  badges.reduce<Tone>((w, b) => (RANK[b.tone] > RANK[w] ? b.tone : w), 'neutral');
