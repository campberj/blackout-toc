import type { Campaign, Pool, Track } from '$lib/packs/schema';
import type { CampaignState } from '$lib/domain/campaign';

// Track → segmented meter view (one segment per point, milestone ticks on segment boundaries).

export interface TrackSegment {
  /** Track value this segment represents when filled. */
  value: number;
  filled: boolean;
}

export interface MilestoneTick {
  key: string;
  at: number;
  /** 0..1 position along the meter (boundary after segment `at`). */
  pos: number;
  fired: boolean;
  reached: boolean;
}

export interface TrackView {
  key: string;
  name: string;
  value: number;
  min: number;
  max: number;
  segments: TrackSegment[];
  ticks: MilestoneTick[];
  /** Next milestone not yet reached, if any. */
  next: MilestoneTick | null;
}

export function trackView(track: Track, s: CampaignState): TrackView {
  const value = s.tracks[track.key]?.value ?? track.initial;
  const fired = s.tracks[track.key]?.fired ?? [];
  const span = Math.max(1, track.max - track.min);
  const segments: TrackSegment[] = [];
  for (let v = track.min + 1; v <= track.max; v++) segments.push({ value: v, filled: v <= value });
  const ticks = [...track.milestones]
    .sort((a, b) => a.at - b.at)
    .map((m) => ({ key: m.key, at: m.at, pos: (m.at - track.min) / span, fired: fired.includes(m.key), reached: value >= m.at }));
  return { key: track.key, name: track.name, value, min: track.min, max: track.max, segments, ticks, next: ticks.find((t) => !t.reached) ?? null };
}

export const trackViews = (campaign: Campaign, s: CampaignState): TrackView[] => campaign.tracks.map((t) => trackView(t, s));

export interface PoolView {
  key: string;
  name: string;
  value: number;
  max: number | null;
}

export const poolViews = (campaign: Campaign, s: CampaignState): PoolView[] =>
  campaign.pools.map((p: Pool) => ({ key: p.key, name: p.name, value: s.pools[p.key] ?? p.initial, max: p.max ?? null }));

export interface AssetView {
  key: string;
  name: string;
  text: string | null;
  count: number;
  /** Team name for team-held assets; null = campaign-level. */
  team: string | null;
}

/** Held assets (count > 0), campaign-level first, then per team. */
export function assetViews(campaign: Campaign, s: CampaignState): AssetView[] {
  const def = (k: string) => campaign.assets.find((a) => a.key === k);
  const row = (k: string, count: number, team: string | null): AssetView => ({ key: k, name: def(k)?.name ?? k, text: def(k)?.text ?? null, count, team });
  return [
    ...Object.entries(s.assets).filter(([, n]) => n > 0).map(([k, n]) => row(k, n, null)),
    ...s.teamOrder.flatMap((t) => Object.entries(s.teams[t]!.assets).filter(([, n]) => n > 0).map(([k, n]) => row(k, n, s.teams[t]!.name))),
  ];
}

export interface FlagView {
  key: string;
  label: string;
  value: string;
}

/**
 * Flags are untyped pack internals; show only "raised" ones (true, non-zero, non-empty), with
 * the key humanized. False/0/'' flags are bookkeeping and stay hidden.
 */
export function flagViews(s: CampaignState): FlagView[] {
  return Object.entries(s.flags)
    .filter(([, v]) => v !== false && v !== 0 && v !== '')
    .map(([k, v]) => ({ key: k, label: humanize(k), value: v === true ? 'Yes' : String(v) }));
}

export const humanize = (key: string): string => {
  const s = key.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
