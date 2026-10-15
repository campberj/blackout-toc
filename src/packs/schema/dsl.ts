import { z } from 'zod';
import { int, Key, LIMITS, list, LongText, Name, Ref, Scalar, ShortText, Tags } from './common';

// Closed Effect + Condition DSLs (DESIGN §6). No scripting: every op is data the engine interprets.
// Adding an op is cheap; renaming/removing one breaks published packs (DESIGN §12).

/**
 * Operator selector, defined once and reused by every op that targets operators.
 * - `participants`: operators recorded as participating in the current mission's AAR
 * - `roster`: every active operator
 * - `subject`: the operator the current context is about (per-operator AAR field, onOperatorKia)
 * - `operator:<key>` / `team:<key>`: a named operator / every active operator in a team
 * Team/campaign-scoped ladders resolve operator targets to their team (or ignore target).
 */
export const TARGET_KEYWORDS = ['participants', 'roster', 'subject'] as const;
export const Target = z
  .union([z.enum(TARGET_KEYWORDS), z.templateLiteral(['operator:', Key]), z.templateLiteral(['team:', Key])])
  .meta({ id: 'Target', description: "'participants' | 'roster' | 'subject' | 'operator:<key>' | 'team:<key>'" });

/** How a multi-operator target satisfies a condition. */
export const Quantifier = z.enum(['any', 'all', 'none']).default('any');

/** Template text: `{{var}}` placeholders, var = dotted identifier. */
const VAR_RE = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;
export const TemplateText = LongText.refine(
  (s) => !s.replace(VAR_RE, '').includes('{{') && !s.replace(VAR_RE, '').includes('}}'),
  'Malformed {{var}} placeholder',
);
/** Extract `{{var}}` names (shared with the engine/authoring tools). */
export const templateVars = (s: string): string[] => [...s.matchAll(VAR_RE)].map((m) => m[1] ?? '');

const cond = <S extends string, T extends z.ZodRawShape>(op: S, shape: T) => z.strictObject({ op: z.literal(op), ...shape });

const CMP = z.enum(['gte', 'lte', 'eq']).default('gte');

export const Condition = z
  .discriminatedUnion('op', [
    cond('flag', { flag: Key, equals: Scalar.optional() }),
    cond('trackGte', { track: Key, value: int(-999, 999) }),
    cond('poolGte', { pool: Key, value: int(-9999, 9999) }),
    /** mission absent = the mission being resolved. */
    cond('missionOutcome', { mission: Key.optional(), outcomes: z.array(Key).min(1).max(8) }),
    cond('ladderIs', { ladder: Key, target: Target.optional(), states: z.array(Key).min(1).max(16), match: Quantifier }),
    cond('operatorStat', { target: Target, stat: Key, cmp: CMP, value: int(-9999, 9999), match: Quantifier }),
    cond('stageIs', { stage: Key }),
    /** Seeded die roll: passes when 1d`sides` >= `gte`. */
    cond('roll', { sides: int(2, 100), gte: int(1, 100) }),
    // Recursive members: explicit getter return types break the TS inference cycle.
    z.strictObject({
      op: z.literal('all'),
      get of(): z.ZodArray<typeof Condition> {
        return z.array(Condition).min(1).max(LIMITS.list);
      },
    }),
    z.strictObject({
      op: z.literal('any'),
      get of(): z.ZodArray<typeof Condition> {
        return z.array(Condition).min(1).max(LIMITS.list);
      },
    }),
    z.strictObject({
      op: z.literal('not'),
      get cond(): typeof Condition {
        return Condition;
      },
    }),
  ])
  .meta({ id: 'Condition' });

/** Narrative content; shared by NarrativeBlock, inline effect narrative, and table entries. */
export const narrativeBody = {
  title: Name.optional(),
  text: TemplateText,
  /** Persona key (campaign.personas). */
  speaker: Key.optional(),
  tags: Tags,
};

export const NarrativeBlock = z
  .strictObject({
    key: Key,
    ...narrativeBody,
    get when() {
      return Condition.optional();
    },
  })
  .meta({ id: 'NarrativeBlock' });

/** Reference a campaign narrative block by key, or inline one. */
export const NarrativeRef = z
  .union([Key, z.strictObject(narrativeBody)])
  .meta({ id: 'NarrativeRef', description: 'NarrativeBlock key, or inline {title?, text, speaker?, tags}' });

export const OperatorSeed = z
  .strictObject({
    key: Key.optional(),
    /** Absent = roll from roster.nameTable. */
    name: Name.optional(),
    callsign: Name.optional(),
    /** Unit card this operator belongs to. */
    unit: Ref.optional(),
    stats: z.record(Key, int(-9999, 9999)).optional(),
    fields: z.record(Key, Scalar).optional(),
    tags: Tags,
  })
  .meta({ id: 'OperatorSeed' });

export const TeamDef = z
  .strictObject({
    key: Key,
    name: Name,
    callsign: Name.optional(),
    text: ShortText.optional(),
    operators: list(OperatorSeed, 24),
    tags: Tags,
  })
  .meta({ id: 'TeamDef' });

const eff = cond;
const AMOUNT = int(-9999, 9999);

export const REMOVE_REASONS = ['kia', 'mia', 'captured', 'retired', 'transferred'] as const;

export const Effect = z
  .discriminatedUnion('op', [
    eff('addXp', { target: Target, amount: AMOUNT }),
    /** Move along the ladder; clamps at the ends. Positive = toward the last state. */
    eff('stepLadder', { ladder: Key, target: Target.optional(), steps: int(-16, 16) }),
    eff('setLadder', { ladder: Key, target: Target.optional(), state: Key }),
    eff('adjustPool', { pool: Key, amount: AMOUNT }),
    eff('adjustTrack', { track: Key, amount: AMOUNT }),
    eff('setFlag', { flag: Key, value: Scalar.default(true) }),
    eff('addOperator', { team: Key, operator: OperatorSeed }),
    eff('removeOperator', { target: Target, reason: z.enum(REMOVE_REASONS) }),
    eff('addTeam', { team: TeamDef }),
    eff('unlockMission', { mission: Key, stage: Key.optional() }),
    eff('lockMission', { mission: Key }),
    eff('rollTable', { table: Ref, times: int(1, 5).default(1) }),
    eff('showNarrative', { narrative: NarrativeRef }),
    /** team absent = campaign-level asset. */
    eff('grantAsset', { asset: Key, team: Key.optional(), count: int(1, 99).default(1) }),
    /** rank absent = next rank on roster.ranks. */
    eff('promote', { target: Target, rank: Key.optional() }),
    /** Generic operator stat change (custom stats from roster.stats; clamps to min/max). */
    eff('adjustStat', { target: Target, stat: Key, amount: AMOUNT }),
    /** Branch without duplicating outcomes. Recursive: getters break the TS inference cycle. */
    z.strictObject({
      op: z.literal('if'),
      get cond(): typeof Condition {
        return Condition;
      },
      get then(): z.ZodArray<typeof Effect> {
        return z.array(Effect).max(LIMITS.list);
      },
      get else(): z.ZodOptional<z.ZodArray<typeof Effect>> {
        return z.array(Effect).max(LIMITS.list).optional();
      },
    }),
  ])
  .meta({ id: 'Effect' });

export const Effects = list(Effect, LIMITS.list);

export const EFFECT_OPS = Effect.options.map((o) => o.shape.op.value);
export const CONDITION_OPS = Condition.options.map((o) => o.shape.op.value);

export type Target = z.infer<typeof Target>;
export type Condition = z.infer<typeof Condition>;
export type ConditionOp = Condition['op'];
export type Effect = z.infer<typeof Effect>;
export type EffectOp = Effect['op'];
export type NarrativeBlock = z.infer<typeof NarrativeBlock>;
export type NarrativeRef = z.infer<typeof NarrativeRef>;
export type OperatorSeed = z.infer<typeof OperatorSeed>;
export type TeamDef = z.infer<typeof TeamDef>;
