import type { OperatorSeed, Scalar, StatDef, TeamDef } from '$lib/packs/schema';
import { weightedPick } from '../rng/rng';
import { log, warn, type Ctx, type Scope } from './context';
import { eligibleEntries } from './narrative';
import { BUILTIN_STATS, qualify, type HistoryEntry, type OperatorState } from './state';

// Roster mechanics shared by startCampaign, effects, and choices (one place for operator/team creation rules).

const history = (ctx: Ctx, op: OperatorState, kind: HistoryEntry['kind'], text: string) => op.history.push({ seq: ctx.seq, kind, text });

export const statDef = (ctx: Ctx, key: string): StatDef | undefined => ctx.campaign.roster.stats.find((s) => s.key === key);

export const isKnownStat = (ctx: Ctx, key: string) => (BUILTIN_STATS as readonly string[]).includes(key) || !!statDef(ctx, key);

function clampStat(ctx: Ctx, key: string, v: number): number {
  const d = statDef(ctx, key);
  if (!d) return Math.max(0, v); // built-ins are counters
  return Math.min(d.max ?? Infinity, Math.max(d.min ?? -Infinity, v));
}

export const teamFull = (ctx: Ctx, team: string) => {
  const max = ctx.campaign.roster.operatorsPerTeam?.max;
  const size = ctx.s.teams[team]?.operators.filter((k) => ctx.s.operators[k]?.status === 'active').length ?? 0;
  return max !== undefined && size >= max;
};

/** Roll a name from roster.nameTable (content filter applies), falling back to a numbered placeholder. */
export function rollName(ctx: Ctx, scope: Scope): string {
  const fallback = `Operator ${ctx.s.counters.operator + 1}`;
  const ref = ctx.campaign.roster.nameTable;
  if (!ref) return fallback;
  const table = ctx.content.get('table', qualify(ctx.campaign.id, ref));
  if (!table) {
    warn(ctx, `Unknown name table "${ref}"`);
    return fallback;
  }
  const entries = eligibleEntries(ctx, scope, table.entries);
  return entries.length ? weightedPick(ctx.rng, entries).label : fallback;
}

function uniqueOperatorKey(ctx: Ctx, wanted: string | undefined): string {
  const n = ctx.s.counters.operator;
  if (wanted && !ctx.s.operators[wanted]) return wanted;
  let i = n + 1;
  const base = wanted ?? 'op';
  while (ctx.s.operators[`${base}-${i}`]) i++;
  return `${base}-${i}`;
}

/** Fill in name now so a pending choice can show it and replay stays stable. */
export const materializeSeed = (ctx: Ctx, scope: Scope, seed: OperatorSeed): OperatorSeed => (seed.name ? seed : { ...seed, name: rollName(ctx, scope) });

/** Create an operator in an existing team. Returns the key. */
export function createOperator(ctx: Ctx, scope: Scope, team: string, seed: OperatorSeed): string {
  const { campaign, s } = ctx;
  const name = seed.name ?? rollName(ctx, scope);
  const key = uniqueOperatorKey(ctx, seed.key);
  s.counters.operator++;
  const stats: Record<string, number> = { xp: 0, kills: 0, missions: 0 };
  for (const d of campaign.roster.stats) stats[d.key] = d.initial;
  for (const [k, v] of Object.entries(seed.stats ?? {})) {
    if (isKnownStat(ctx, k)) stats[k] = clampStat(ctx, k, v);
    else warn(ctx, `Unknown stat "${k}" on operator ${name}`);
  }
  const fields: Record<string, Scalar> = {};
  for (const f of campaign.roster.operatorFields) if (f.default !== undefined) fields[f.key] = f.default;
  Object.assign(fields, seed.fields ?? {});
  const ladders: Record<string, string> = {};
  for (const l of campaign.ladders) if (l.scope === 'operator') ladders[l.key] = l.initial;
  const op: OperatorState = {
    key,
    name,
    callsign: seed.callsign ?? null,
    unit: seed.unit ? qualify(campaign.id, seed.unit) : null,
    team,
    status: 'active',
    removal: null,
    stats,
    rank: campaign.roster.ranks[0]?.key ?? null,
    ladders,
    fields,
    tags: [...seed.tags],
    history: [],
  };
  s.operators[key] = op;
  s.teams[team]!.operators.push(key);
  history(ctx, op, 'joined', `Joined ${s.teams[team]!.name}`);
  log(ctx, `${name} joined ${s.teams[team]!.name}.`, { type: 'roster', key });
  autoPromote(ctx, key);
  return key;
}

/** Create a team (and its seeded operators). Returns false when skipped. */
export function createTeam(ctx: Ctx, scope: Scope, def: TeamDef, extra: readonly OperatorSeed[] = []): boolean {
  const { campaign, s } = ctx;
  if (s.teams[def.key]) {
    warn(ctx, `Team "${def.key}" already exists`);
    return false;
  }
  if (campaign.roster.teamsMax !== undefined && s.teamOrder.length >= campaign.roster.teamsMax) {
    warn(ctx, `Team limit (${campaign.roster.teamsMax}) reached; ${def.name} not added`);
    return false;
  }
  const ladders: Record<string, string> = {};
  for (const l of campaign.ladders) if (l.scope === 'team') ladders[l.key] = l.initial;
  s.teams[def.key] = {
    key: def.key,
    name: def.name,
    callsign: def.callsign ?? null,
    text: def.text ?? null,
    tags: [...def.tags],
    operators: [],
    ladders,
    assets: {},
  };
  s.teamOrder.push(def.key);
  log(ctx, `${def.name} formed.`, { type: 'roster', key: def.key });
  for (const seed of [...def.operators, ...extra]) createOperator(ctx, scope, def.key, seed);
  return true;
}

/** Apply a stat delta (clamped). `xp` also checks auto-promotion. */
export function adjustOperatorStat(ctx: Ctx, opKey: string, stat: string, amount: number): void {
  const op = ctx.s.operators[opKey]!;
  const before = op.stats[stat] ?? 0;
  const after = clampStat(ctx, stat, before + amount);
  if (after === before) return;
  op.stats[stat] = after;
  history(ctx, op, stat === 'xp' ? 'xp' : 'stat', `${stat} ${before} → ${after}`);
  if (stat === 'xp') autoPromote(ctx, opKey);
}

const rankIndex = (ctx: Ctx, rank: string | null) => ctx.campaign.roster.ranks.findIndex((r) => r.key === rank);

/** Promote upward to the highest rank whose xp threshold is met (never demotes; xp-less ranks are promote-only). */
export function autoPromote(ctx: Ctx, opKey: string): void {
  const op = ctx.s.operators[opKey]!;
  const ranks = ctx.campaign.roster.ranks;
  let best = rankIndex(ctx, op.rank);
  ranks.forEach((r, i) => {
    if (r.xp !== undefined && (op.stats.xp ?? 0) >= r.xp && i > best) best = i;
  });
  if (best > rankIndex(ctx, op.rank)) setRank(ctx, opKey, ranks[best]!.key);
}

export function setRank(ctx: Ctx, opKey: string, rank: string): void {
  const op = ctx.s.operators[opKey]!;
  if (op.rank === rank) return;
  const name = ctx.campaign.roster.ranks.find((r) => r.key === rank)?.name ?? rank;
  op.rank = rank;
  history(ctx, op, 'rank', `Promoted to ${name}`);
  log(ctx, `${op.name} promoted to ${name}.`, { type: 'roster', key: opKey });
}

/** Next rank in roster order, or undefined at the top. */
export const nextRank = (ctx: Ctx, opKey: string): string | undefined => ctx.campaign.roster.ranks[rankIndex(ctx, ctx.s.operators[opKey]!.rank) + 1]?.key;

export { history as pushHistory };
