import type { Trigger, TriggerEvent } from '$lib/packs/schema';
import { passes } from './conditions';
import type { Ctx, Scope, TriggerInfo } from './context';
import { adjustPool, applyEffects } from './effects';
import { showNarrative } from './narrative';

const FILTER_KEYS = ['stage', 'mission', 'track', 'milestone'] as const;

const filterMatches = (t: Trigger, info: TriggerInfo) => FILTER_KEYS.every((k) => t.filter?.[k] === undefined || t.filter[k] === info[k]);

/**
 * Fire a trigger event: pool refresh rules first (so trigger `when` sees refreshed pools),
 * then matching triggers in declaration order. Narrative renders before its effects.
 */
export function fireTrigger(ctx: Ctx, on: TriggerEvent, info: TriggerInfo, scope: Scope): void {
  if (ctx.halted) return;
  for (const pool of ctx.campaign.pools) {
    for (const r of pool.refresh) if (r.on === on && passes(ctx, scope, r.when)) adjustPool(ctx, pool.key, r.amount, r.mode);
  }
  for (const t of ctx.campaign.triggers) {
    if (ctx.halted) return;
    if (t.on !== on || (t.once && ctx.s.firedTriggers.includes(t.key)) || !filterMatches(t, info)) continue;
    const ts: Scope = { ...scope, subject: info.subject ?? scope.subject, mission: info.mission ?? scope.mission, source: { type: 'trigger', key: t.key } };
    if (!passes(ctx, ts, t.when)) continue;
    if (t.once) ctx.s.firedTriggers.push(t.key);
    showNarrative(ctx, ts, t.narrative);
    applyEffects(ctx, ts, t.effects);
  }
}
