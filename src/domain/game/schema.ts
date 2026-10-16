import { z } from 'zod';
import { Id, int, Key, Name, ShortText, TextBlock } from '$lib/packs/schema';

// GameSession setup (DESIGN §4 F3). Persisted inside the GameStarted event, so a session replays
// identically even after packs change: everything the tracker needs is snapshotted here.

export const SIDES = ['player', 'opfor'] as const;
export const Side = z.enum(SIDES);

export const MODEL_STATUSES = ['active', 'down', 'destroyed', 'embarked', 'reserve', 'escaped', 'captured'] as const;
export const ModelStatus = z.enum(MODEL_STATUSES);

export const PHASES = ['operations', 'execution'] as const;
export const Phase = z.enum(PHASES);

export const UNIT_TOKENS = ['activated', 'pinned'] as const;
export const MODEL_TOKENS = ['ready', 'engaged'] as const;
export const Token = z.enum([...UNIT_TOKENS, ...MODEL_TOKENS]);

/** Card rule key; specialist rules are `specialistKey/ruleKey` (matches app `cardKeys`). */
export const RuleKey = z
  .string()
  .max(130)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'Expected rule key');

export const ModelSetup = z.strictObject({
  key: Key,
  name: Name,
  /** Campaign operator this model represents (maps results back to the AAR). */
  operatorKey: Key.optional(),
  status: ModelStatus.default('active'),
});

const uniqueBy =
  <T>(field: keyof T & string, what: string) =>
  (items: readonly T[], ctx: z.RefinementCtx) => {
    const seen = new Set<unknown>();
    items.forEach((it, i) => {
      if (seen.has(it[field])) ctx.addIssue({ code: 'custom', message: `Duplicate ${what} "${String(it[field])}"`, path: [i, field] });
      seen.add(it[field]);
    });
  };

/** A unit before it is placed in a session (no key/side yet): quick-add, custom contact, roster entry. */
export const UnitTemplate = z.strictObject({
  name: Name,
  /** Source card, when there is one (custom contacts have none). */
  unitId: Id.optional(),
  /** Force card of the unit's group (battle drills). */
  forceId: Id.optional(),
  /** Roster group index, for grouping on the board. */
  group: int(0, 8).optional(),
  combatLoads: int(0, 9).default(0),
  /** Limited-use rules only (always-on rules need no tracking). */
  rules: z
    .array(z.strictObject({ key: RuleKey, name: Name, usesMax: int(1, 9) }))
    .max(24)
    .default([])
    .superRefine(uniqueBy('key', 'rule')),
  /** Damage tracks, applied per model. Empty = removed on first damage. */
  tracks: z
    .array(z.strictObject({ key: Key, name: Name, size: int(1, 12) }))
    .max(4)
    .default([])
    .superRefine(uniqueBy('key', 'track')),
  models: z.array(ModelSetup).min(1).max(20).superRefine(uniqueBy('key', 'model')),
});

export const UnitSetup = z.strictObject({ ...UnitTemplate.shape, key: Key, side: Side });

export const ObjectiveSetup = z.strictObject({
  key: Key,
  label: Name,
  points: int(-99, 99),
  /** Times it can score per side; absent = unlimited. 1 renders as a checkbox. */
  max: int(1, 99).optional(),
  /** Only this side can score it; absent = both. */
  side: Side.optional(),
  timing: z
    .strictObject({ when: z.enum(['immediate', 'end-of-round', 'end-of-game']), rounds: z.array(int(1, 12)).max(12).optional() })
    .prefault({ when: 'immediate' }),
  text: TextBlock.optional(),
});

export const SessionLink = z.strictObject({ campaignSaveId: z.string().min(1).max(64), mission: Key });

export const GameSetup = z.strictObject({
  name: Name,
  rulesetId: Id.optional(),
  rosterId: z.string().min(1).max(64).optional(),
  scenarioId: Id.optional(),
  link: SessionLink.optional(),
  roundLimit: int(1, 12),
  startingCp: int(0, 20),
  /** Per-round CP spend caps by reason key (RulesetProfile.cpCaps). */
  cpCaps: z.record(Key, int(0, 99)).default({}),
  /** How a reached cap is enforced: `block` (overridable with force) or `warn`. */
  capMode: z.enum(['block', 'warn']).default('block'),
  scoreLabel: Name.default('VP'),
  sides: z.strictObject({ player: z.strictObject({ name: Name }), opfor: z.strictObject({ name: Name }) }),
  scenarioName: Name.optional(),
  /** Display only. */
  specialRules: z.array(z.strictObject({ key: Key, name: Name, text: TextBlock.optional() })).max(16).default([]),
  objectives: z.array(ObjectiveSetup).max(48).default([]).superRefine(uniqueBy('key', 'objective')),
  units: z.array(UnitSetup).max(64).default([]).superRefine(uniqueBy('key', 'unit')),
});

/** A generic OPFOR unit with no card. */
export const CustomContact = z.strictObject({
  name: Name,
  models: int(1, 20),
  track: z.strictObject({ name: Name, size: int(1, 12) }).optional(),
});

export const NoteText = ShortText.min(1);

export type Side = z.infer<typeof Side>;
export type ModelStatus = z.infer<typeof ModelStatus>;
export type Phase = z.infer<typeof Phase>;
export type Token = z.infer<typeof Token>;
export type ModelSetup = z.infer<typeof ModelSetup>;
export type UnitTemplate = z.output<typeof UnitTemplate>;
export type UnitTemplateInput = z.input<typeof UnitTemplate>;
export type UnitSetup = z.output<typeof UnitSetup>;
export type ObjectiveSetup = z.output<typeof ObjectiveSetup>;
export type SessionLink = z.infer<typeof SessionLink>;
export type GameSetup = z.output<typeof GameSetup>;
export type GameSetupInput = z.input<typeof GameSetup>;
export type CustomContact = z.infer<typeof CustomContact>;
