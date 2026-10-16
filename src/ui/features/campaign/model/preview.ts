import type { Campaign } from '$lib/packs/schema';
import type { CampaignState, FeedEntry } from '$lib/domain/campaign';
import { ladderBadge, type LadderBadge } from './ladders';

// State before/after a command → what changes (AAR preview, debrief summary).

export interface Change<T> {
  from: T;
  to: T;
}

export interface LadderChange {
  ladder: string;
  ladderName: string;
  from: LadderBadge;
  to: LadderBadge;
}

export interface OperatorChange {
  key: string;
  name: string;
  callsign: string | null;
  xp: Change<number> | null;
  rank: Change<string | null> | null;
  stats: (Change<number> & { name: string })[];
  ladders: LadderChange[];
  removed: string | null;
  joined: boolean;
}

export interface NamedChange extends Change<number> {
  key: string;
  name: string;
}

export interface StateDiff {
  operators: OperatorChange[];
  teams: { key: string; name: string; ladders: LadderChange[] }[];
  tracks: NamedChange[];
  pools: NamedChange[];
  assets: NamedChange[];
  missions: { key: string; name: string; from: string; to: string }[];
  /** New narrative transmissions. */
  narrative: FeedEntry[];
  newChoices: number;
  stageComplete: boolean;
  empty: boolean;
}

const rankName = (c: Campaign, k: string | null) => (k === null ? null : (c.roster.ranks.find((r) => r.key === k)?.name ?? k));

function ladderChanges(campaign: Campaign, before: Record<string, string>, after: Record<string, string>): LadderChange[] {
  return campaign.ladders.flatMap((l) => {
    const a = before[l.key];
    const b = after[l.key];
    if (a === b || b === undefined) return [];
    return [{ ladder: l.key, ladderName: l.name, from: ladderBadge(l, a ?? l.initial), to: ladderBadge(l, b) }];
  });
}

const numberDiff = (keys: readonly { key: string; name: string }[], a: Record<string, number>, b: Record<string, number>): NamedChange[] =>
  keys.flatMap((k) => ((a[k.key] ?? 0) === (b[k.key] ?? 0) ? [] : [{ key: k.key, name: k.name, from: a[k.key] ?? 0, to: b[k.key] ?? 0 }]));

export function diffStates(campaign: Campaign, before: CampaignState, after: CampaignState): StateDiff {
  const operators: OperatorChange[] = [];
  for (const [key, op] of Object.entries(after.operators)) {
    const prev = before.operators[key];
    const xp = (prev?.stats.xp ?? 0) !== (op.stats.xp ?? 0) ? { from: prev?.stats.xp ?? 0, to: op.stats.xp ?? 0 } : null;
    const rank = prev && prev.rank !== op.rank ? { from: rankName(campaign, prev.rank), to: rankName(campaign, op.rank) } : null;
    const stats = campaign.roster.stats.flatMap((d) =>
      (prev?.stats[d.key] ?? d.initial) === (op.stats[d.key] ?? d.initial) ? [] : [{ name: d.name, from: prev?.stats[d.key] ?? d.initial, to: op.stats[d.key] ?? d.initial }],
    );
    const ladders = prev ? ladderChanges(campaign, prev.ladders, op.ladders) : [];
    const removed = op.status === 'removed' && prev?.status !== 'removed' ? (op.removal?.reason ?? 'removed') : null;
    const joined = !prev;
    if (xp || rank || stats.length || ladders.length || removed || joined) operators.push({ key, name: op.name, callsign: op.callsign, xp, rank, stats, ladders, removed, joined });
  }
  const teams = after.teamOrder.flatMap((k) => {
    const ladders = ladderChanges(campaign, before.teams[k]?.ladders ?? {}, after.teams[k]!.ladders);
    return ladders.length ? [{ key: k, name: after.teams[k]!.name, ladders }] : [];
  });
  const trackVals = (s: CampaignState) => Object.fromEntries(Object.entries(s.tracks).map(([k, t]) => [k, t.value]));
  const assetKeys = campaign.assets.map((a) => ({ key: a.key, name: a.name }));
  const allAssets = (s: CampaignState) => {
    const out: Record<string, number> = { ...s.assets };
    for (const t of Object.values(s.teams)) for (const [k, n] of Object.entries(t.assets)) out[k] = (out[k] ?? 0) + n;
    return out;
  };
  const missionName = (k: string) => campaign.missions.find((m) => m.key === k)?.name ?? after.customMissions[k]?.mission.name ?? k;
  const missions = Object.entries(after.missions).flatMap(([k, m]) => {
    const p = before.missions[k];
    // Resolution itself is shown elsewhere; report unlocks/locks.
    if (!p || p.status === m.status || m.status === 'resolved' || p.status === 'active' || m.status === 'active') return [];
    return [{ key: k, name: missionName(k), from: p.status, to: m.status }];
  });
  const lastId = before.feed.at(-1)?.id ?? 0;
  const narrative = after.feed.filter((f) => f.id > lastId && (f.kind === 'narrative' || f.kind === 'filtered'));
  const diff: StateDiff = {
    operators,
    teams,
    tracks: numberDiff(campaign.tracks, trackVals(before), trackVals(after)),
    pools: numberDiff(campaign.pools, before.pools, after.pools),
    assets: numberDiff(assetKeys, allAssets(before), allAssets(after)),
    missions,
    narrative,
    newChoices: Math.max(0, after.pending.length - before.pending.length),
    stageComplete: !before.stageComplete && after.stageComplete,
    empty: false,
  };
  diff.empty = !operators.length && !teams.length && !diff.tracks.length && !diff.pools.length && !diff.assets.length && !missions.length && !diff.newChoices;
  return diff;
}
