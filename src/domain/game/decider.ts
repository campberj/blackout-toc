import { humanizeKey } from '../cards/format';
import type { Decision } from '../events';
import { GameCommand, type GameCommandInput, type GameEvent } from './commands';
import type { Side } from './schema';
import { findModel, findUnit, isOut, type GameState, type UnitState } from './state';

// Validation is data-driven (ruleset caps, round limit, card maxima). `block` issues reject the
// command unless it is `overridable` and sent with `force`; `warn` issues never block.

export interface GameIssue {
  readonly severity: 'warn' | 'block';
  readonly code: string;
  readonly message: string;
  readonly overridable: boolean;
}

const block = (code: string, message: string, overridable = false): GameIssue => ({ severity: 'block', code, message, overridable });
const warn = (code: string, message: string): GameIssue => ({ severity: 'warn', code, message, overridable: true });

const MAX_UNITS = 64;
const MAX_OBJECTIVES = 48;
const MAX_ROUND = 99;

type Checker<T extends GameCommand['type']> = (s: GameState, c: Extract<GameCommand, { type: T }>) => GameIssue[];

function withUnit(s: GameState, key: string, fn: (u: UnitState) => GameIssue[]): GameIssue[] {
  const u = findUnit(s, key);
  return u ? fn(u) : [block('unknown-unit', `Unknown unit "${key}"`)];
}
function withModel(s: GameState, unit: string, model: string, fn: (u: UnitState, m: NonNullable<ReturnType<typeof findModel>>) => GameIssue[]): GameIssue[] {
  return withUnit(s, unit, (u) => {
    const m = findModel(u, model);
    return m ? fn(u, m) : [block('unknown-model', `Unknown model "${model}" in ${u.name}`)];
  });
}

function cpIssues(s: GameState, side: Side, amount: number, reason: string | undefined): GameIssue[] {
  const out: GameIssue[] = [];
  const have = s.sides[side].cp;
  if (amount > have) out.push(block('cp-short', `${s.sides[side].name} has ${have} CP; ${amount} needed`));
  const cap = reason === undefined ? undefined : s.cpCaps[reason];
  if (reason !== undefined && cap !== undefined && (s.sides[side].capUses[reason] ?? 0) >= cap) {
    const msg = `${humanizeKey(reason)} is limited to ${cap} per round`;
    out.push(s.capMode === 'block' ? block('cp-cap', msg, true) : warn('cp-cap', msg));
  }
  return out;
}

const CHECKS: { [T in GameCommand['type']]: Checker<T> } = {
  startGame: () => [],
  addUnit: (s) => (s.units.length >= MAX_UNITS ? [block('unit-limit', `A game holds at most ${MAX_UNITS} units`)] : []),
  advanceRound: (s) => {
    const out: GameIssue[] = [];
    if (s.round >= MAX_ROUND) return [block('round-max', `Round ${MAX_ROUND} is the last trackable round`)];
    if (s.round >= s.roundLimit) out.push(block('round-limit', `Round limit (${s.roundLimit}) reached`, true));
    const idle = s.units.filter((u) => !u.activated && u.models.some((m) => m.status === 'active'));
    if (idle.length) out.push(warn('not-activated', `${idle.length} unit${idle.length === 1 ? ' has' : 's have'} not activated`));
    return out;
  },
  setPhase: () => [],
  setInitiative: () => [],
  spendCp: (s, c) => cpIssues(s, c.side, c.amount, c.reason),
  adjustCp: () => [],
  adjustVp: () => [],
  adjustBurnCards: () => [],
  setToken: (s, c) =>
    withUnit(s, c.unit, (u) => {
      const modelToken = c.token === 'ready' || c.token === 'engaged';
      if (modelToken && c.model === undefined) return [block('model-required', `${humanizeKey(c.token)} is a model token`)];
      if (!modelToken && c.model !== undefined) return [block('unit-token', `${humanizeKey(c.token)} is a unit token`)];
      if (c.model !== undefined && !findModel(u, c.model)) return [block('unknown-model', `Unknown model "${c.model}" in ${u.name}`)];
      return [];
    }),
  useDrill: (s, c) =>
    withUnit(s, c.unit, (u) => [
      ...(u.drillUsed ? [block('drill-used', `${u.name} already used a drill this round`, true)] : []),
      ...(u.activated ? [warn('drill-activated', `${u.name} has already activated`)] : []),
      ...(u.forceId === null ? [warn('no-force', `${u.name} has no force card`)] : []),
      ...cpIssues(s, u.side, c.cp, 'battle-drill'),
    ]),
  setLoads: (s, c) =>
    withUnit(s, c.unit, (u) => [
      ...(c.used > u.combatLoads ? [block('loads-max', `${u.name} has ${u.combatLoads} combat load${u.combatLoads === 1 ? '' : 's'}`)] : []),
      ...(c.model !== undefined && !findModel(u, c.model) ? [block('unknown-model', `Unknown model "${c.model}" in ${u.name}`)] : []),
    ]),
  setRuleBoxes: (s, c) =>
    withUnit(s, c.unit, (u) => {
      const r = u.rules.find((x) => x.key === c.rule);
      if (!r) return [block('unknown-rule', `${u.name} has no limited-use rule "${c.rule}"`)];
      return c.ticked > r.usesMax ? [block('rule-max', `${r.name} has ${r.usesMax} box${r.usesMax === 1 ? '' : 'es'}`)] : [];
    }),
  setDamage: (s, c) =>
    withModel(s, c.unit, c.model, (u, m) => {
      const t = u.tracks.find((x) => x.key === c.track);
      if (!t) return [block('unknown-track', `${u.name} has no damage track "${c.track}"`)];
      if (c.marked > t.size) return [block('track-max', `${t.name} has ${t.size} boxes`)];
      return isOut(m) ? [warn('model-out', `${m.name} is ${m.status}`)] : [];
    }),
  setModelStatus: (s, c) => withModel(s, c.unit, c.model, () => []),
  creditKill: (s, c) => withModel(s, c.unit, c.model, (_u, m) => (m.kills + c.delta < 0 ? [block('kills-min', `${m.name} has ${m.kills} kills`)] : [])),
  scoreObjective: (s, c) => {
    const o = s.objectives.find((x) => x.key === c.objective);
    if (!o) return [block('unknown-objective', `Unknown objective "${c.objective}"`)];
    const next = o.scored[c.side] + c.delta;
    if (o.side && o.side !== c.side) return [block('objective-side', `Only ${s.sides[o.side].name} scores ${o.label}`)];
    if (next < 0) return [block('objective-min', `${o.label} has not been scored`)];
    if (o.max !== undefined && next > o.max) return [block('objective-max', `${o.label} scores at most ${o.max}×`)];
    return [];
  },
  addObjective: (s) => (s.objectives.length >= MAX_OBJECTIVES ? [block('objective-limit', `At most ${MAX_OBJECTIVES} objectives`)] : []),
  note: () => [],
  endGame: (s) => (s.round < s.roundLimit ? [warn('early-end', `Ending in round ${s.round} of ${s.roundLimit}`)] : []),
};

/** Lifecycle + command-specific issues for an already-parsed command. */
export function checkCommand(s: GameState, c: GameCommand): GameIssue[] {
  if (c.type === 'startGame') return s.started ? [block('started', 'The game has already started')] : [];
  if (!s.started) return [block('not-started', 'The game has not started')];
  if (s.ended && c.type !== 'note') return [block('ended', 'The game has ended; undo to reopen it')];
  return (CHECKS[c.type] as Checker<typeof c.type>)(s, c as never);
}

export const isForced = (c: GameCommand): boolean => 'force' in c && c.force === true;
export const blocking = (issues: readonly GameIssue[], forced: boolean): GameIssue[] =>
  issues.filter((i) => i.severity === 'block' && !(forced && i.overridable));

type Draft = Decision<GameEvent> & { ok: true };
type Emit<T extends GameCommand['type']> = (s: GameState, c: Extract<GameCommand, { type: T }>) => Draft['events'];
const ev = <T extends GameEvent['type']>(type: T, payload: Extract<GameEvent, { type: T }>['payload']) => ({ type, payload }) as Draft['events'][number];
const opt = <K extends string, V>(k: K, v: V | undefined): Partial<Record<K, V>> => (v === undefined ? {} : ({ [k]: v } as Record<K, V>));

function nextKey(taken: readonly string[], prefix: string): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const EMIT: { [T in GameCommand['type']]: Emit<T> } = {
  startGame: (_s, c) => [ev('GameStarted', { setup: c.setup })],
  addUnit: (s, c) => [
    ev('UnitAdded', {
      unit: { ...c.unit, side: c.side, key: nextKey(s.units.filter((u) => u.side === c.side).map((u) => u.key), c.side === 'player' ? 'p' : 'o') },
    }),
  ],
  advanceRound: (s) => [ev('RoundAdvanced', { round: s.round + 1 })],
  setPhase: (_s, c) => [ev('PhaseSet', { phase: c.phase })],
  setInitiative: (_s, c) => [ev('InitiativeSet', { side: c.side })],
  spendCp: (_s, c) => [ev('CpSpent', { side: c.side, amount: c.amount, ...opt('reason', c.reason) })],
  adjustCp: (_s, c) => [ev('CpAdjusted', { side: c.side, amount: c.amount })],
  adjustVp: (_s, c) => [ev('VpAdjusted', { side: c.side, amount: c.amount })],
  adjustBurnCards: (_s, c) => [ev('BurnCardsAdjusted', { side: c.side, amount: c.amount })],
  setToken: (_s, c) => [ev('TokenSet', { unit: c.unit, token: c.token, value: c.value, ...opt('model', c.model) })],
  useDrill: (s, c) => [
    ev('DrillUsed', { unit: c.unit }),
    ...(c.cp > 0 ? [ev('CpSpent', { side: findUnit(s, c.unit)!.side, amount: c.cp, reason: 'battle-drill' })] : []),
  ],
  setLoads: (_s, c) => [ev('LoadSpent', { unit: c.unit, used: c.used, ...opt('model', c.model) })],
  setRuleBoxes: (_s, c) => [ev('RuleBoxTicked', { unit: c.unit, rule: c.rule, ticked: c.ticked })],
  setDamage: (_s, c) => [ev('DamageMarked', { unit: c.unit, model: c.model, track: c.track, marked: c.marked })],
  setModelStatus: (_s, c) => [ev('ModelStatusChanged', { unit: c.unit, model: c.model, status: c.status })],
  creditKill: (_s, c) => [ev('KillCredited', { unit: c.unit, model: c.model, delta: c.delta })],
  scoreObjective: (_s, c) => [ev('ObjectiveScored', { objective: c.objective, side: c.side, delta: c.delta })],
  addObjective: (s, c) => [
    ev('ObjectiveAdded', {
      key: nextKey(
        s.objectives.filter((o) => o.custom).map((o) => o.key),
        'custom-',
      ),
      label: c.label,
      points: c.points,
      ...opt('side', c.side),
      ...opt('max', c.max),
    }),
  ],
  note: (_s, c) => [ev('Note', { text: c.text })],
  endGame: () => [ev('GameEnded', {})],
};

export type GameDecision = { ok: true; command: GameCommand; events: Draft['events']; issues: GameIssue[] } | { ok: false; error: string; issues: GameIssue[] };

/** Parse, check and emit. Exposes issues (warnings + blocks) for the UI. */
export function decideGame(s: GameState, input: GameCommandInput): GameDecision {
  const parsed = GameCommand.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: message, issues: [block('invalid', message)] };
  }
  const c = parsed.data;
  const issues = checkCommand(s, c);
  const stop = blocking(issues, isForced(c));
  if (stop.length) return { ok: false, error: stop.map((i) => i.message).join('; '), issues };
  return { ok: true, command: c, events: (EMIT[c.type] as Emit<typeof c.type>)(s, c as never), issues };
}
