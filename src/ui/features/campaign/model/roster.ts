import type { Campaign } from '$lib/packs/schema';
import type { CampaignState, HistoryEntry, OperatorState, RemoveReason } from '$lib/domain/campaign';
import { operatorBadges, operatorLadders, teamBadges, worstTone, type LadderBadge, type Tone } from './ladders';
import type { EventRef } from './feed';
import { xpProgress, type XpProgress } from './xp';

// Roster screen + operator selection: teams → operators with ladder badges and progress.

export interface StatView {
  key: string;
  name: string;
  value: number;
}

export interface OperatorRow {
  key: string;
  name: string;
  callsign: string | null;
  team: string;
  teamName: string;
  rankName: string | null;
  xp: XpProgress;
  missions: number;
  kills: number;
  badges: LadderBadge[];
  allLadders: LadderBadge[];
  tone: Tone;
  stats: StatView[];
  tags: string[];
  active: boolean;
  removal: { reason: RemoveReason; label: string } | null;
}

export interface TeamView {
  key: string;
  name: string;
  callsign: string | null;
  text: string | null;
  badges: LadderBadge[];
  tone: Tone;
  /** Missions this team took part in during the current stage (teamMissions). */
  stageMissions: number;
  operators: OperatorRow[];
  size: number;
  maxSize: number | null;
}

export const REASON_LABEL: Record<RemoveReason, string> = {
  kia: 'Killed in action',
  mia: 'Missing in action',
  captured: 'Captured',
  retired: 'Retired',
  transferred: 'Transferred',
  destroyed: 'Destroyed',
};

export function operatorRow(campaign: Campaign, s: CampaignState, op: OperatorState): OperatorRow {
  const badges = operatorBadges(campaign, op);
  return {
    key: op.key,
    name: op.name,
    callsign: op.callsign,
    team: op.team,
    teamName: s.teams[op.team]?.name ?? op.team,
    rankName: campaign.roster.ranks.find((r) => r.key === op.rank)?.name ?? op.rank,
    xp: xpProgress(campaign, op),
    missions: op.stats.missions ?? 0,
    kills: op.stats.kills ?? 0,
    badges,
    allLadders: operatorLadders(campaign, op),
    tone: op.status === 'active' ? worstTone(badges) : 'neutral',
    stats: campaign.roster.stats.map((d) => ({ key: d.key, name: d.name, value: op.stats[d.key] ?? d.initial })),
    tags: op.tags,
    active: op.status === 'active',
    removal: op.removal ? { reason: op.removal.reason, label: REASON_LABEL[op.removal.reason] } : null,
  };
}

/** Teams in roster order with their active operators. */
export function teamViews(campaign: Campaign, s: CampaignState): TeamView[] {
  return s.teamOrder.map((k) => {
    const t = s.teams[k]!;
    const badges = teamBadges(campaign, t);
    const operators = t.operators.map((o) => s.operators[o]!).filter((o) => o.status === 'active').map((o) => operatorRow(campaign, s, o));
    return {
      key: k,
      name: t.name,
      callsign: t.callsign,
      text: t.text,
      badges,
      tone: worstTone(badges),
      stageMissions: s.teamStageMissions[s.stage ?? '']?.[k] ?? 0,
      operators,
      size: operators.length,
      maxSize: campaign.roster.operatorsPerTeam?.max ?? null,
    };
  });
}

export interface MemorialEntry {
  key: string;
  name: string;
  callsign: string | null;
  teamName: string;
  reason: string;
  stage: string | null;
  missions: number;
}

/** Stage index active when event `seq` applied: one StageAdvanced per stage after the first. */
export function stageAtSeq(events: readonly EventRef[], seq: number): number {
  return events.filter((e) => e.type === 'StageAdvanced' && e.seq < seq).length;
}

export function memorial(campaign: Campaign, s: CampaignState, events: readonly EventRef[]): MemorialEntry[] {
  return Object.values(s.operators)
    .filter((o) => o.status === 'removed' && o.removal)
    .sort((a, b) => a.removal!.seq - b.removal!.seq)
    .map((o) => ({
      key: o.key,
      name: o.name,
      callsign: o.callsign,
      teamName: s.teams[o.team]?.name ?? o.team,
      reason: REASON_LABEL[o.removal!.reason],
      stage: campaign.timeline.stages[stageAtSeq(events, o.removal!.seq)]?.name ?? null,
      missions: o.stats.missions ?? 0,
    }));
}

export type HistoryGroup = 'missions' | 'injuries' | 'promotions' | 'record';

export const HISTORY_GROUPS: readonly { id: HistoryGroup; label: string; kinds: HistoryEntry['kind'][] }[] = [
  { id: 'missions', label: 'Missions', kinds: ['mission'] },
  { id: 'injuries', label: 'Status changes', kinds: ['ladder', 'removed'] },
  { id: 'promotions', label: 'Promotions', kinds: ['rank'] },
  { id: 'record', label: 'Service record', kinds: ['joined', 'xp', 'stat', 'updated'] },
];

/** Operator history split into the drawer's sections (newest first within each). */
export function historyGroups(op: OperatorState): { id: HistoryGroup; label: string; entries: HistoryEntry[] }[] {
  return HISTORY_GROUPS.map((g) => ({ id: g.id, label: g.label, entries: op.history.filter((h) => g.kinds.includes(h.kind)).reverse() }));
}

/** Warnings for a participant selection: teams off-green and operators carrying a bad state. */
export function selectionWarnings(teams: readonly TeamView[], selected: readonly string[]): { tone: Tone; text: string }[] {
  const out: { tone: Tone; text: string }[] = [];
  for (const t of teams) {
    const picked = t.operators.filter((o) => selected.includes(o.key));
    if (!picked.length) continue;
    for (const b of t.badges) if (b.tone === 'warn' || b.tone === 'crit') out.push({ tone: b.tone, text: `${t.name} is ${b.label} (${b.ladderName}).` });
    for (const o of picked) {
      const bad = o.badges.filter((b) => b.tone === 'warn' || b.tone === 'crit');
      if (bad.length) out.push({ tone: worstTone(bad), text: `${o.name}: ${bad.map((b) => b.label).join(', ')}.` });
    }
  }
  return out;
}
