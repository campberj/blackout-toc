import type { Campaign } from '$lib/packs/schema';
import type { CampaignEventType, FeedEntry } from '$lib/domain/campaign';

// Narrative feed → message-traffic groups (one group per player command, newest first).

export type FeedFilter = 'all' | 'traffic' | 'log' | 'alerts';

export const FEED_FILTERS: readonly { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'traffic', label: 'Transmissions' },
  { id: 'log', label: 'Log' },
  { id: 'alerts', label: 'Alerts' },
];

const MATCH: Record<FeedFilter, (e: FeedEntry) => boolean> = {
  all: () => true,
  traffic: (e) => e.kind === 'narrative' || e.kind === 'filtered',
  log: (e) => e.kind === 'system',
  alerts: (e) => e.kind === 'warning' || e.kind === 'error',
};

/** Minimal event view (stored events carry more; `cmd` absent on legacy saves). */
export interface EventRef {
  seq: number;
  cmd?: number | undefined;
  type: string;
  at?: string | undefined;
  payload?: unknown;
}

export interface FeedGroup {
  cmd: number;
  label: string;
  at: string | null;
  entries: FeedEntry[];
}

const LABELS: Record<CampaignEventType, string> = {
  CampaignStarted: 'Campaign started',
  MissionBegun: 'Mission begun',
  MissionCancelled: 'Mission aborted',
  AarResolved: 'After-action report',
  StageAdvanced: 'Stage advanced',
  CustomMissionAdded: 'Custom mission added',
  RandomEventRolled: 'Random event',
  ManualAdjustmentApplied: 'GM adjustment',
  ChoiceResolved: 'Choice resolved',
  OperatorUpdated: 'Record updated',
  ContentFilterSet: 'Content filter changed',
};

export const eventLabel = (type: string): string => LABELS[type as CampaignEventType] ?? type;

/** Group feed entries by the command that produced them; groups newest first, entries in reading order. */
export function groupFeed(feed: readonly FeedEntry[], events: readonly EventRef[], filter: FeedFilter = 'all'): FeedGroup[] {
  const bySeq = new Map(events.map((e) => [e.seq, e]));
  const groups = new Map<number, FeedGroup>();
  for (const entry of feed) {
    if (!MATCH[filter](entry)) continue;
    const ev = bySeq.get(entry.seq);
    const cmd = ev?.cmd ?? entry.seq;
    let g = groups.get(cmd);
    if (!g) {
      g = { cmd, label: ev ? eventLabel(ev.type) : 'Event', at: ev?.at ?? null, entries: [] };
      groups.set(cmd, g);
    }
    // Label after the command's last event (MissionBegun + AarResolved reads as the AAR).
    if (ev) g.label = eventLabel(ev.type);
    g.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => b.cmd - a.cmd);
}

/** Feed entries produced at or after `seq` (debrief / opening orders / roll results). */
export const entriesSince = (feed: readonly FeedEntry[], seq: number): FeedEntry[] => feed.filter((e) => e.seq >= seq);

export interface LastCommand {
  cmd: number;
  label: string;
  detail: string | null;
}

/** The command `undo` would remove; null when only the start remains. */
export function lastCommand(campaign: Campaign | undefined, events: readonly EventRef[]): LastCommand | null {
  const last = events.at(-1);
  if (!last || events.length === 0) return null;
  const cmd = last.cmd ?? last.seq;
  const firstCmd = events[0]!.cmd ?? events[0]!.seq;
  if (cmd === firstCmd) return null;
  return { cmd, label: eventLabel(last.type), detail: eventDetail(campaign, last) };
}

function eventDetail(campaign: Campaign | undefined, e: EventRef): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const missionName = (k: unknown) => campaign?.missions.find((m) => m.key === k)?.name ?? (typeof k === 'string' ? k : null);
  switch (e.type) {
    case 'AarResolved':
      return missionName((p.aar as { mission?: unknown } | undefined)?.mission);
    case 'MissionBegun':
    case 'MissionCancelled':
      return missionName(p.mission);
    case 'ManualAdjustmentApplied':
      return typeof p.note === 'string' ? p.note : null;
    case 'RandomEventRolled':
      return typeof p.table === 'string' ? p.table : null;
    case 'CustomMissionAdded':
      return (p.mission as { name?: string } | undefined)?.name ?? null;
    default:
      return null;
  }
}

export interface DebriefView {
  kind: 'opening' | 'stage' | 'debrief';
  /** Transmissions from the command (briefing traffic excluded: it was read before play). */
  traffic: FeedEntry[];
  log: FeedEntry[];
}

/** Everything one command produced, starting at its first event `from`. */
export function debriefView(feed: readonly FeedEntry[], events: readonly EventRef[], from: number): DebriefView {
  const first = events.find((e) => e.seq === from);
  const cmd = first?.cmd ?? from;
  const seqs = new Set(events.filter((e) => (e.cmd ?? e.seq) === cmd).map((e) => e.seq));
  const entries = feed.filter((e) => e.seq >= from && (seqs.size === 0 || seqs.has(e.seq)));
  return {
    kind: first?.type === 'CampaignStarted' ? 'opening' : first?.type === 'StageAdvanced' ? 'stage' : 'debrief',
    traffic: entries.filter((e) => (e.kind === 'narrative' || e.kind === 'filtered') && e.source.type !== 'briefing'),
    log: entries.filter((e) => e.kind === 'system' || e.kind === 'warning' || e.kind === 'error'),
  };
}
