import type { Effect, Ladder } from '$lib/packs/schema';
import { weightedPick } from '../rng/rng';
import { passes, evaluate } from './conditions';
import { halt, log, MAX_DEPTH, MAX_STEPS, pushFeed, warn, type Ctx, type Scope } from './context';
import { eligibleEntries, emitNarrative, isExcluded, NEUTRAL_TABLE_TEXT, showNarrative } from './narrative';
import { adjustOperatorStat, createOperator, createTeam, isKnownStat, materializeSeed, nextRank, pushHistory, setRank, teamFull } from './roster';
import { activeTeamOperators, qualify } from './state';
import { resolveLadderSlots, resolveOperators, type LadderSlot } from './targets';

const names = (ctx: Ctx, keys: readonly string[]) => keys.map((k) => ctx.s.operators[k]!.name).join(', ');
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Interpret an effect list in order. Mutates ctx.s (a per-event working copy). Caps guard runaway chains. */
export function applyEffects(ctx: Ctx, scope: Scope, effects: readonly Effect[]): void {
  if (ctx.halted || effects.length === 0) return;
  if (++ctx.depth > MAX_DEPTH) {
    halt(ctx, `effect/trigger nesting exceeded ${MAX_DEPTH} levels (likely a trigger loop)`);
  } else {
    for (const e of effects) {
      if (ctx.halted) break;
      if (++ctx.steps > MAX_STEPS) {
        halt(ctx, `more than ${MAX_STEPS} effects in one step (likely a trigger loop)`);
        break;
      }
      applyEffect(ctx, scope, e);
    }
  }
  ctx.depth--;
}

function findLadder(ctx: Ctx, key: string): Ladder | undefined {
  const l = ctx.campaign.ladders.find((x) => x.key === key);
  if (!l) warn(ctx, `Unknown ladder "${key}"`);
  return l;
}

/** Move one ladder slot; runs matching transitions then the new state's onEnter. */
function moveLadder(ctx: Ctx, scope: Scope, ladder: Ladder, slot: LadderSlot, to: string): void {
  const from = slot.get() ?? ladder.initial;
  if (from === to) return;
  slot.set(to);
  const toName = ladder.states.find((x) => x.key === to)!.name;
  const fromName = ladder.states.find((x) => x.key === from)?.name ?? from;
  const holderName =
    ladder.scope === 'operator' ? ctx.s.operators[slot.holder!]!.name : ladder.scope === 'team' ? ctx.s.teams[slot.holder!]!.name : 'Campaign';
  log(ctx, `${holderName}: ${ladder.name} ${fromName} → ${toName}.`, { type: 'effect', key: ladder.key });
  if (ladder.scope === 'operator') pushHistory(ctx, ctx.s.operators[slot.holder!]!, 'ladder', `${ladder.name}: ${fromName} → ${toName}`);
  // Effects of a ladder move are about its holder (operator scope), never the outer subject.
  const inner: Scope = { ...scope, subject: ladder.scope === 'operator' ? slot.holder! : undefined, source: { type: 'effect', key: ladder.key } };
  for (const t of ladder.transitions) {
    if ((t.from === '*' || t.from === from) && t.to === to && passes(ctx, inner, t.when)) applyEffects(ctx, inner, t.effects);
  }
  applyEffects(ctx, inner, ladder.states.find((x) => x.key === to)!.onEnter);
}

function clamp(v: number, min: number, max: number | undefined) {
  return Math.min(max ?? Infinity, Math.max(min, v));
}

/** Adjust a track, firing milestones crossed upward (ascending `at`). */
export function adjustTrack(ctx: Ctx, scope: Scope, key: string, amount: number): void {
  const def = ctx.campaign.tracks.find((t) => t.key === key);
  const st = ctx.s.tracks[key];
  if (!def || !st) return warn(ctx, `Unknown track "${key}"`);
  const before = st.value;
  const after = clamp(before + amount, def.min, def.max);
  if (after === before) return;
  st.value = after;
  log(ctx, `${def.name} ${signed(after - before)} (now ${after}).`, { type: 'effect', key });
  const crossed = def.milestones.filter((m) => before < m.at && m.at <= after).sort((a, b) => a.at - b.at);
  for (const m of crossed) {
    if (ctx.halted) return;
    if (m.once && st.fired.includes(m.key)) continue;
    if (!st.fired.includes(m.key)) st.fired.push(m.key);
    const ms: Scope = { ...scope, source: { type: 'milestone', key: `${key}.${m.key}` } };
    showNarrative(ctx, ms, m.narrative);
    applyEffects(ctx, ms, m.effects);
    ctx.fire('onTrackMilestone', { stage: ctx.s.stage ?? undefined, track: key, milestone: m.key }, scope);
  }
}

export function adjustPool(ctx: Ctx, key: string, amount: number, mode: 'add' | 'set' = 'add'): void {
  const def = ctx.campaign.pools.find((p) => p.key === key);
  if (!def || ctx.s.pools[key] === undefined) return warn(ctx, `Unknown pool "${key}"`);
  const before = ctx.s.pools[key];
  const after = clamp(mode === 'set' ? amount : before + amount, def.min, def.max);
  if (after === before) return;
  ctx.s.pools[key] = after;
  log(ctx, `${def.name} ${signed(after - before)} (now ${after}).`, { type: 'effect', key });
}

/** Roll a table `times`; filtered-out or all-ineligible tables produce a neutral entry. */
export function rollTable(ctx: Ctx, scope: Scope, ref: string, times = 1): void {
  const table = ctx.content.get('table', qualify(ctx.campaign.id, ref));
  if (!table) return warn(ctx, `Unknown table "${ref}"`);
  for (let i = 0; i < times && !ctx.halted; i++) {
    const ts: Scope = { ...scope, source: { type: 'table', key: table.id } };
    // A table tagged with an excluded tag is wholly filtered.
    const entries = isExcluded(table.tags, ctx.s.excludedTags) ? [] : eligibleEntries(ctx, ts, table.entries);
    if (entries.length === 0) {
      pushFeed(ctx.s, ctx.seq, { kind: 'narrative', title: table.name, text: NEUTRAL_TABLE_TEXT, source: ts.source });
      continue;
    }
    const e = weightedPick(ctx.rng, entries);
    log(ctx, `${table.name}: ${e.label}.`, ts.source);
    if (e.narrative) emitNarrative(ctx, ts, { ...e.narrative, title: e.narrative.title ?? e.label, tags: [...e.narrative.tags, ...e.tags] });
    applyEffects(ctx, ts, e.effects);
  }
}

function applyEffect(ctx: Ctx, scope: Scope, e: Effect): void {
  const s = ctx.s;
  switch (e.op) {
    case 'addXp': {
      const ops = resolveOperators(ctx, scope, e.target);
      ops.forEach((k) => adjustOperatorStat(ctx, scope, k, 'xp', e.amount));
      if (ops.length) log(ctx, `${signed(e.amount)} XP: ${names(ctx, ops)}.`);
      return;
    }
    case 'adjustStat': {
      if (!isKnownStat(ctx, e.stat)) return warn(ctx, `Unknown stat "${e.stat}"`);
      const ops = resolveOperators(ctx, scope, e.target);
      ops.forEach((k) => adjustOperatorStat(ctx, scope, k, e.stat, e.amount));
      if (ops.length) log(ctx, `${signed(e.amount)} ${e.stat}: ${names(ctx, ops)}.`);
      return;
    }
    case 'stepLadder':
    case 'setLadder': {
      const ladder = findLadder(ctx, e.ladder);
      if (!ladder) return;
      if (e.op === 'setLadder' && !ladder.states.some((x) => x.key === e.state)) return warn(ctx, `Unknown state "${e.state}" on ladder "${e.ladder}"`);
      for (const slot of resolveLadderSlots(ctx, scope, ladder, e.target)) {
        if (ctx.halted) return;
        // Holder may have been removed by an earlier slot's onEnter chain.
        if (ladder.scope === 'operator' && s.operators[slot.holder!]!.status !== 'active') continue;
        let to: string;
        if (e.op === 'setLadder') to = e.state;
        else {
          const i = ladder.states.findIndex((x) => x.key === (slot.get() ?? ladder.initial));
          to = ladder.states[Math.min(ladder.states.length - 1, Math.max(0, i + e.steps))]!.key;
        }
        moveLadder(ctx, scope, ladder, slot, to);
      }
      return;
    }
    case 'adjustPool':
      return adjustPool(ctx, e.pool, e.amount);
    case 'adjustTrack':
      return adjustTrack(ctx, scope, e.track, e.amount);
    case 'setFlag':
      s.flags[e.flag] = e.value;
      return;
    case 'addOperator': {
      if (s.teams[e.team] && !teamFull(ctx, e.team)) {
        createOperator(ctx, scope, e.team, e.operator);
        return;
      }
      // Team gone or full: the player decides where the recruit goes (resolveChoice).
      const seed = materializeSeed(ctx, scope, e.operator);
      const key = `choice-${++s.counters.choice}`;
      const why = s.teams[e.team] ? `${s.teams[e.team]!.name} is at full strength` : `team "${e.team}" does not exist`;
      s.pending.push({ key, kind: 'placeOperator', prompt: `${seed.name} is available but ${why}. Assign to a team or discard.`, operator: seed, team: e.team, seq: ctx.seq });
      log(ctx, `Decision needed: place ${seed.name}.`, { type: 'roster', key });
      return;
    }
    case 'removeOperator': {
      for (const k of resolveOperators(ctx, scope, e.target)) {
        if (ctx.halted) return;
        const op = s.operators[k]!;
        if (op.status !== 'active') continue;
        op.status = 'removed';
        op.removal = { reason: e.reason, seq: ctx.seq };
        pushHistory(ctx, op, 'removed', `Removed: ${e.reason.toUpperCase()}`);
        log(ctx, `${op.name} removed from the roster (${e.reason.toUpperCase()}).`, { type: 'roster', key: k });
        if (e.reason === 'kia') ctx.fire('onOperatorKia', { stage: s.stage ?? undefined, subject: k }, { ...scope, subject: k });
      }
      return;
    }
    case 'addTeam':
      createTeam(ctx, scope, e.team);
      return;
    case 'unlockMission': {
      const ms = s.missions[e.mission];
      if (!ms) return warn(ctx, `Unknown mission "${e.mission}"`);
      if (e.stage) {
        if (!ctx.campaign.timeline.stages.some((st) => st.key === e.stage)) return warn(ctx, `Unknown stage "${e.stage}"`);
        ms.stage = e.stage;
      }
      if (ms.status === 'locked') {
        ms.status = 'available';
        log(ctx, `Mission unlocked: ${missionName(ctx, e.mission)}.`, { type: 'mission', key: e.mission });
      }
      return;
    }
    case 'lockMission': {
      const ms = s.missions[e.mission];
      if (!ms) return warn(ctx, `Unknown mission "${e.mission}"`);
      if (ms.status === 'available') {
        ms.status = 'locked';
        log(ctx, `Mission locked: ${missionName(ctx, e.mission)}.`, { type: 'mission', key: e.mission });
      }
      return;
    }
    case 'rollTable': {
      const override = ctx.s.faction === null ? undefined : e.byFaction?.find((f) => f.faction === ctx.s.faction);
      return rollTable(ctx, scope, override?.table ?? e.table, e.times);
    }
    case 'showNarrative':
      return showNarrative(ctx, scope, e.narrative);
    case 'grantAsset': {
      const def = ctx.campaign.assets.find((a) => a.key === e.asset);
      if (!def) return warn(ctx, `Unknown asset "${e.asset}"`);
      if (e.team !== undefined && !s.teams[e.team]) return warn(ctx, `Unknown team "${e.team}"`);
      const bag = e.team === undefined ? s.assets : s.teams[e.team]!.assets;
      bag[e.asset] = (bag[e.asset] ?? 0) + e.count;
      log(ctx, `Asset gained: ${def.name} ×${e.count}${e.team ? ` (${s.teams[e.team]!.name})` : ''}.`, { type: 'effect', key: e.asset });
      return;
    }
    case 'promote': {
      if (e.rank !== undefined && !ctx.campaign.roster.ranks.some((r) => r.key === e.rank)) return warn(ctx, `Unknown rank "${e.rank}"`);
      for (const k of resolveOperators(ctx, scope, e.target)) {
        const rank = e.rank ?? nextRank(ctx, k);
        if (rank) setRank(ctx, scope, k, rank);
      }
      return;
    }
    case 'if':
      return applyEffects(ctx, scope, evaluate(ctx, scope, e.cond) ? e.then : (e.else ?? []));
    case 'forEachTeam':
      // Snapshot: teams added inside the loop are not visited; teams emptied mid-loop are skipped.
      for (const team of [...s.teamOrder]) {
        if (ctx.halted) return;
        if (activeTeamOperators(s, team).length === 0) continue;
        const inner: Scope = { ...scope, team };
        if (passes(ctx, inner, e.where)) applyEffects(ctx, inner, e.effects);
      }
      return;
  }
}

const missionName = (ctx: Ctx, key: string) => ctx.campaign.missions.find((m) => m.key === key)?.name ?? ctx.s.customMissions[key]?.mission.name ?? key;
