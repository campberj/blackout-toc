import type { Campaign, Condition, TriggerEvent } from '$lib/packs/schema';
import type { ContentLookup } from '../content';
import type { Rng } from '../rng/rng';
import type { CampaignState, FeedEntry, FeedSource, Speaker } from './state';

/** Nesting cap for effect lists (triggers → effects → ladders → triggers …). */
export const MAX_DEPTH = 32;
/** Total effects interpreted per event. Either cap halts the event with an error entry (never a hang). */
export const MAX_STEPS = 5000;

/** Who/what the effects being interpreted are about. */
export interface Scope {
  /** Operator key bound to the `subject` target. */
  subject?: string | undefined;
  /** Mission being started/resolved (missionOutcome default, mission.* vars). */
  mission?: string | undefined;
  /** forEachTeam loop team (`team` target, team ladders, teamMissions). */
  team?: string | undefined;
  /** Operators recorded as participating in the AAR. */
  participants: readonly string[];
  /** Feed source for narrative produced in this scope. */
  source: { type: FeedSource; key: string | null };
}

export interface TriggerInfo {
  stage?: string | undefined;
  mission?: string | undefined;
  track?: string | undefined;
  milestone?: string | undefined;
  rank?: string | undefined;
  subject?: string | undefined;
}

/** Mutable working copy for one event's reduction; the reducer clones state first, so callers see purity. */
export interface Ctx {
  readonly content: ContentLookup;
  readonly campaign: Campaign;
  readonly s: CampaignState;
  readonly rng: Rng;
  readonly seq: number;
  depth: number;
  steps: number;
  halted: boolean;
  /** Fire a trigger event (hook breaks the effects ↔ triggers import cycle). */
  fire(on: TriggerEvent, info: TriggerInfo, scope: Scope): void;
  /** Evaluate a condition (hook lets target filters reuse the evaluator without an import cycle). */
  check(scope: Scope, c: Condition): boolean;
}

export const emptyScope = (type: FeedSource = 'engine', key: string | null = null): Scope => ({ participants: [], source: { type, key } });

export function pushFeed(
  s: CampaignState,
  seq: number,
  e: { kind: FeedEntry['kind']; text: string; title?: string | null; speaker?: Speaker | null; source: Scope['source'] },
): void {
  s.feed.push({ id: ++s.counters.feed, seq, kind: e.kind, title: e.title ?? null, text: e.text, speaker: e.speaker ?? null, source: { ...e.source } });
}

export const log = (ctx: Ctx, text: string, source: Scope['source'] = { type: 'engine', key: null }) =>
  pushFeed(ctx.s, ctx.seq, { kind: 'system', text, source });

export const warn = (ctx: Ctx, text: string) => pushFeed(ctx.s, ctx.seq, { kind: 'warning', text, source: { type: 'engine', key: null } });

/** Halts the rest of this event's interpretation; state keeps what was applied (deterministic on replay). */
export function halt(ctx: Ctx, why: string): void {
  if (ctx.halted) return;
  ctx.halted = true;
  pushFeed(ctx.s, ctx.seq, { kind: 'error', text: `Engine halted this step: ${why}. Remaining effects were skipped.`, source: { type: 'engine', key: null } });
}
