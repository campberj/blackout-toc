import type { Campaign } from '$lib/packs/schema';
import type { OperatorState } from '$lib/domain/campaign';

// XP → rank progress. Ranks without an xp threshold are promote-only and are skipped as "next".

export interface XpProgress {
  xp: number;
  rank: string | null;
  rankName: string | null;
  /** Next xp-gated rank above the current one. */
  next: { key: string; name: string; xp: number } | null;
  /** 0..1 progress from the current rank's threshold to the next; 1 at the top. */
  ratio: number;
  /** XP still needed for `next`. */
  toNext: number;
}

export function xpProgress(campaign: Campaign, op: OperatorState): XpProgress {
  const ranks = campaign.roster.ranks;
  const xp = op.stats.xp ?? 0;
  const i = ranks.findIndex((r) => r.key === op.rank);
  const current = i >= 0 ? ranks[i]! : null;
  const nextDef = ranks.slice(i + 1).find((r) => r.xp !== undefined);
  const floor = current?.xp ?? 0;
  const next = nextDef ? { key: nextDef.key, name: nextDef.name, xp: nextDef.xp! } : null;
  const ratio = next ? Math.max(0, Math.min(1, (xp - floor) / Math.max(1, next.xp - floor))) : 1;
  return { xp, rank: op.rank, rankName: current?.name ?? op.rank, next, ratio, toNext: next ? Math.max(0, next.xp - xp) : 0 };
}
