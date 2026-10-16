import { z } from 'zod';
import { int, Key, Name } from '$lib/packs/schema';
import type { DomainEvent } from '../events';
import { GameSetup, ModelStatus, NoteText, Phase, RuleKey, Side, Token, UnitSetup, UnitTemplate } from './schema';

// Commands are Zod-validated (UI input is untrusted). Events carry absolute values where the UI
// sets a value (pips), so replay never depends on prior state being "right".

const cmd = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) => z.strictObject({ type: z.literal(type), ...shape });
/** GM override for overridable blocks (caps, round limit, drill reuse). */
const force = { force: z.boolean().default(false) };
const unit = { unit: Key };
const model = { unit: Key, model: Key };

export const GameCommand = z.discriminatedUnion('type', [
  cmd('startGame', { setup: GameSetup }),
  /** Key and side are assigned by the decider. */
  cmd('addUnit', { side: Side, unit: UnitTemplate }),
  cmd('advanceRound', force),
  cmd('setPhase', { phase: Phase }),
  cmd('setInitiative', { side: Side.nullable() }),
  /** `reason` = a cpCaps key (counted against its per-round cap) or any label. */
  cmd('spendCp', { side: Side, amount: int(1, 20).default(1), reason: Key.optional(), ...force }),
  /** Corrections and the rare CP gain; never below 0. */
  cmd('adjustCp', { side: Side, amount: int(-20, 20) }),
  cmd('adjustVp', { side: Side, amount: int(-99, 99) }),
  cmd('adjustBurnCards', { side: Side, amount: int(-20, 20) }),
  cmd('setToken', { ...unit, model: Key.optional(), token: Token, value: z.boolean() }),
  /** Battle drill: marks the unit and spends `cp`. */
  cmd('useDrill', { ...unit, cp: int(0, 9).default(1), ...force }),
  cmd('setLoads', { ...unit, used: int(0, 9), model: Key.optional() }),
  cmd('setRuleBoxes', { ...unit, rule: RuleKey, ticked: int(0, 9) }),
  cmd('setDamage', { ...model, track: Key, marked: int(0, 12) }),
  cmd('setModelStatus', { ...model, status: ModelStatus }),
  cmd('creditKill', { ...model, delta: int(-5, 5).refine((n) => n !== 0, 'delta must not be 0').default(1) }),
  cmd('scoreObjective', { objective: Key, side: Side, delta: int(-5, 5).refine((n) => n !== 0, 'delta must not be 0').default(1) }),
  cmd('addObjective', { label: Name, points: int(-99, 99), side: Side.optional(), max: int(1, 99).optional() }),
  cmd('note', { text: NoteText }),
  cmd('endGame', {}),
]);

export type GameCommandInput = z.input<typeof GameCommand>;
export type GameCommand = z.output<typeof GameCommand>;
export type GameCommandOf<T extends GameCommand['type']> = Extract<GameCommand, { type: T }>;

// ── Events ───────────────────────────────────────────────────────────────
/** Persisted payload schemas (validate logs loaded from storage). */
export const GAME_EVENT_PAYLOADS = {
  GameStarted: z.strictObject({ setup: GameSetup }),
  UnitAdded: z.strictObject({ unit: UnitSetup }),
  RoundAdvanced: z.strictObject({ round: int(1, 99) }),
  PhaseSet: z.strictObject({ phase: Phase }),
  InitiativeSet: z.strictObject({ side: Side.nullable() }),
  CpSpent: z.strictObject({ side: Side, amount: int(0, 20), reason: Key.optional() }),
  CpAdjusted: z.strictObject({ side: Side, amount: int(-20, 20) }),
  VpAdjusted: z.strictObject({ side: Side, amount: int(-99, 99) }),
  BurnCardsAdjusted: z.strictObject({ side: Side, amount: int(-20, 20) }),
  TokenSet: z.strictObject({ ...unit, model: Key.optional(), token: Token, value: z.boolean() }),
  DrillUsed: z.strictObject(unit),
  LoadSpent: z.strictObject({ ...unit, used: int(0, 9), model: Key.optional() }),
  RuleBoxTicked: z.strictObject({ ...unit, rule: RuleKey, ticked: int(0, 9) }),
  DamageMarked: z.strictObject({ ...model, track: Key, marked: int(0, 12) }),
  ModelStatusChanged: z.strictObject({ ...model, status: ModelStatus }),
  KillCredited: z.strictObject({ ...model, delta: int(-5, 5) }),
  ObjectiveScored: z.strictObject({ objective: Key, side: Side, delta: int(-5, 5) }),
  ObjectiveAdded: z.strictObject({ key: Key, label: Name, points: int(-99, 99), side: Side.optional(), max: int(1, 99).optional() }),
  Note: z.strictObject({ text: NoteText }),
  GameEnded: z.strictObject({}),
} as const;

type Payloads = { [K in keyof typeof GAME_EVENT_PAYLOADS]: z.output<(typeof GAME_EVENT_PAYLOADS)[K]> };
export type GameEventType = keyof Payloads;
export type GameEvent = { [K in GameEventType]: DomainEvent<K, Payloads[K]> }[GameEventType];
export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export const GAME_EVENT_TYPES = Object.keys(GAME_EVENT_PAYLOADS) as GameEventType[];

/** Validate a persisted event's payload against its schema. */
export function validateGameEvent(e: Pick<DomainEvent, 'seq' | 'type' | 'payload'>): string | undefined {
  const schema = (GAME_EVENT_PAYLOADS as Record<string, z.ZodType>)[e.type];
  if (!schema) return `Unknown event type "${e.type}"`;
  const r = schema.safeParse(e.payload);
  return r.success ? undefined : `Event ${e.seq} (${e.type}): ${r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
}
