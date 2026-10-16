import type { Campaign, NarrativeBlock, NarrativeRef, Scalar, TableEntry } from '$lib/packs/schema';
import { passes } from './conditions';
import { pushFeed, warn, type Ctx, type Scope } from './context';
import type { CampaignState, Speaker } from './state';

/**
 * Template variable context (`{{var}}`), resolved lazily against live state.
 *
 * - `operator.{key,name,callsign,rank,team,unit,status}`, `operator.<stat>` (xp, kills, missions, roster.stats),
 *   `operator.field.<key>`, `operator.ladder.<key>` (state name). Operator = scope subject.
 * - `team.{key,name,callsign,size}`, `team.ladder.<key>`, `team.asset.<key>`. Team = subject's team, else first team.
 * - `mission.{key,name,outcome,status}`. Mission = mission being begun/resolved.
 * - `campaign.{name,stage,stageKey,faction,factionName}`, `campaign.ladder.<key>`, `campaign.asset.<key>`, `campaign.flag.<key>`.
 * - `track.<key>` (value), `track.<key>.{name,max}`; `pool.<key>` (value), `pool.<key>.name`.
 * - `persona.<key>` (callsign, else name), `persona.<key>.{name,callsign,role}`.
 *
 * Unknown vars (or no operator/mission in scope) render visibly as `[?var]` so authors spot them;
 * a known var with no value (e.g. no callsign) renders empty.
 */
export const TEMPLATE_ROOTS = ['operator', 'team', 'mission', 'campaign', 'track', 'pool', 'persona'] as const;

const VAR_RE = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;

type Val = Scalar | null | undefined;

const named = <T extends { key: string; name: string }>(list: readonly T[], key: string | undefined) => list.find((x) => x.key === key);

function ladderName(campaign: Campaign, ladder: string, state: string | undefined): Val {
  const l = named(campaign.ladders, ladder);
  return state === undefined ? undefined : (named(l?.states ?? [], state)?.name ?? state);
}

export function resolveVar(campaign: Campaign, s: CampaignState, scope: Scope, path: string): Val {
  const [root, a, b] = path.split('.');
  const op = scope.subject ? s.operators[scope.subject] : undefined;
  switch (root) {
    case 'operator': {
      if (!op || !a) return undefined;
      if (a === 'field') return b === undefined ? undefined : op.fields[b];
      if (a === 'ladder') return b === undefined ? undefined : ladderName(campaign, b, op.ladders[b]);
      if (b !== undefined) return undefined;
      if (a === 'rank') return op.rank ? (named(campaign.roster.ranks, op.rank)?.name ?? op.rank) : null;
      if (a === 'team') return s.teams[op.team]?.name;
      if (a === 'key' || a === 'name' || a === 'callsign' || a === 'unit' || a === 'status') return op[a];
      return op.stats[a];
    }
    case 'team': {
      const t = s.teams[op?.team ?? s.teamOrder[0] ?? ''];
      if (!t || !a) return undefined;
      if (a === 'ladder') return b === undefined ? undefined : ladderName(campaign, b, t.ladders[b]);
      if (a === 'asset') return b === undefined ? undefined : (t.assets[b] ?? 0);
      if (b !== undefined) return undefined;
      if (a === 'size') return t.operators.filter((k) => s.operators[k]?.status === 'active').length;
      return a === 'key' || a === 'name' || a === 'callsign' ? t[a] : undefined;
    }
    case 'mission': {
      const key = scope.mission ?? s.activeMission;
      const m = key ? (named(campaign.missions, key) ?? s.customMissions[key]?.mission) : undefined;
      const ms = key ? s.missions[key] : undefined;
      if (!m || !ms || b !== undefined) return undefined;
      if (a === 'key' || a === 'name') return m[a];
      if (a === 'status') return ms.status;
      if (a === 'outcome') return ms.outcome ? (named(m.outcomes, ms.outcome)?.name ?? ms.outcome) : null;
      return undefined;
    }
    case 'campaign': {
      if (a === 'ladder') return b === undefined ? undefined : ladderName(campaign, b, s.ladders[b]);
      if (a === 'asset') return b === undefined ? undefined : (s.assets[b] ?? 0);
      if (a === 'flag') return b === undefined ? undefined : s.flags[b];
      if (b !== undefined) return undefined;
      if (a === 'name') return campaign.name;
      if (a === 'stage') return named(campaign.timeline.stages, s.stage ?? undefined)?.name;
      if (a === 'stageKey') return s.stage;
      if (a === 'faction') return s.faction;
      if (a === 'factionName') return s.faction === null ? null : (named(campaign.factions ?? [], s.faction)?.name ?? s.faction);
      return undefined;
    }
    case 'track': {
      const t = named(campaign.tracks, a);
      if (!t || !a) return undefined;
      if (b === undefined) return s.tracks[a]?.value;
      return b === 'name' ? t.name : b === 'max' ? t.max : undefined;
    }
    case 'pool': {
      const p = named(campaign.pools, a);
      if (!p || !a) return undefined;
      if (b === undefined) return s.pools[a];
      return b === 'name' ? p.name : undefined;
    }
    case 'persona': {
      const p = named(campaign.personas, a);
      if (!p) return undefined;
      if (b === undefined) return p.callsign ?? p.name;
      return b === 'name' ? p.name : b === 'callsign' ? (p.callsign ?? null) : b === 'role' ? (p.role ?? null) : undefined;
    }
    default:
      return undefined;
  }
}

/** Render `{{var}}` placeholders. `undefined` (unknown) → `[?var]`; `null` (known, empty) → ''. */
export function renderTemplate(text: string, lookup: (path: string) => Val): string {
  return text.replace(VAR_RE, (_m, path: string) => {
    const v = lookup(path);
    return v === undefined ? `[?${path}]` : v === null ? '' : String(v);
  });
}

export const isExcluded = (tags: readonly string[], excluded: readonly string[]) => tags.some((t) => excluded.includes(t));

export const FILTERED_TEXT = 'An entry was withheld by your content filter.';
export const NEUTRAL_TABLE_TEXT = 'Nothing of note occurs.';

export function speakerOf(campaign: Campaign, key: string | undefined): Speaker | null {
  const p = named(campaign.personas, key);
  return p ? { key: p.key, name: p.name, callsign: p.callsign ?? null } : null;
}

type Body = { title?: string | undefined; text: string; speaker?: string | undefined; tags: string[]; when?: NarrativeBlock['when'] };

/** Render a narrative body into the feed, honouring `when` and the tag filter (filtered → neutral placeholder). */
export function emitNarrative(ctx: Ctx, scope: Scope, body: Body): void {
  if (!passes(ctx, scope, body.when)) return;
  if (isExcluded(body.tags, ctx.s.excludedTags)) {
    pushFeed(ctx.s, ctx.seq, { kind: 'filtered', text: FILTERED_TEXT, source: scope.source });
    return;
  }
  pushFeed(ctx.s, ctx.seq, {
    kind: 'narrative',
    title: body.title ?? null,
    text: renderTemplate(body.text, (p) => resolveVar(ctx.campaign, ctx.s, scope, p)),
    speaker: speakerOf(ctx.campaign, body.speaker),
    source: scope.source,
  });
}

/** Resolve a NarrativeRef (block key or inline body) and emit it. */
export function showNarrative(ctx: Ctx, scope: Scope, ref: NarrativeRef | undefined): void {
  if (ref === undefined) return;
  if (typeof ref !== 'string') return emitNarrative(ctx, scope, ref);
  const block = ctx.campaign.narratives.find((n) => n.key === ref);
  if (!block) return warn(ctx, `Unknown narrative "${ref}"`);
  emitNarrative(ctx, scope, block);
}

/** Table entries eligible now: not tag-excluded and `when` passes. */
export function eligibleEntries(ctx: Ctx, scope: Scope, entries: readonly TableEntry[]): TableEntry[] {
  return entries.filter((e) => !isExcluded(e.tags, ctx.s.excludedTags) && passes(ctx, scope, e.when));
}
