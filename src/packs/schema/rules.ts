import { z } from 'zod';
import { int, Key, LIMITS, list, LocalId, Name, Ref, ShortText, Tag, Tags, TextBlock, uniqueList } from './common';
import { UNIT_TYPES, UnitType } from './cards';

/** Inclusive integer bounds; both ends optional. */
export const Count = z
  .strictObject({ min: int(0, 999).optional(), max: int(0, 999).optional() })
  .refine((c) => c.min === undefined || c.max === undefined || c.min <= c.max, 'min must be <= max')
  .meta({ id: 'Count' });

/** Unit fields the Forge validators/calibration can address. Counts are list lengths. */
export const UNIT_FIELDS = [
  'skill',
  'move',
  'armor.dice',
  'armor.target',
  'grunts',
  'combatLoads',
  'specialists',
  'weapons',
  'rules',
  'keywords',
  'weapon.maxRange',
  'weapon.damage',
] as const;
export const UnitField = z.enum(UNIT_FIELDS);

/** Which units a constraint applies to. Empty selector = every unit. */
export const UnitSelector = z
  .strictObject({
    types: z.array(UnitType).max(UNIT_TYPES.length).optional(),
    exceptTypes: z.array(UnitType).max(UNIT_TYPES.length).optional(),
    tags: z.array(Tag).max(LIMITS.tags).optional(),
    keywords: z.array(Ref).max(LIMITS.tags).optional(),
  })
  .meta({ id: 'UnitSelector' });

/** One numeric rule on a unit field. Used for hard limits (errors) and calibration (warnings). */
export const FieldCheck = z
  .strictObject({
    key: Key,
    field: UnitField,
    when: UnitSelector.optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    in: z.array(z.number()).max(LIMITS.list).optional(),
    notIn: z.array(z.number()).max(LIMITS.list).optional(),
    message: ShortText,
  })
  .refine((c) => [c.min, c.max, c.in, c.notIn].some((v) => v !== undefined), 'FieldCheck needs min, max, in or notIn')
  .meta({ id: 'FieldCheck' });

export const ROSTER_MODES = ['core', 'matched', 'skirmish'] as const;
export const RosterModeKey = z.enum(ROSTER_MODES);

/** Team composition rules as data (DESIGN §4 Roster). */
export const RosterMode = z
  .strictObject({
    mode: RosterModeKey,
    name: Name,
    groups: Count,
    forceCardsPerGroup: Count,
    /** Non-handler units per group (a duster counts here when it replaces a unit). */
    unitsPerGroup: Count,
    distinctUnitsPerGroup: z.boolean().default(false),
    handlersPerGroup: Count,
    dusters: z.strictObject({ max: int(0, 9), replacesUnit: z.boolean().default(true) }).prefault({ max: 0 }),
    allowedUnitTypes: z.array(UnitType).max(UNIT_TYPES.length).optional(),
    /** Extra caps, e.g. max 1 unit tagged `blklist` per group. */
    limits: list(
      z.strictObject({ key: Key, select: UnitSelector, scope: z.enum(['group', 'roster']), count: Count, message: ShortText }),
      16,
    ),
    text: TextBlock.optional(),
  })
  .meta({ id: 'RosterMode' });

export const RulesetProfile = z
  .strictObject({
    id: LocalId,
    name: Name,
    startingCp: int(0, 20),
    /** Per-round/per-game CP spend caps, e.g. {"chained-activation": 1, "handler-reset": 1}. */
    cpCaps: z.record(Key, int(0, 99)).default({}),
    roundLimit: int(1, 12),
    dusterRules: z.enum(['core', 'impact-frontline', 'impact-chart']),
    coverModel: z.enum(['binary', 'full-partial']),
    /** Forge hard limits (errors). */
    unitLimits: uniqueList(FieldCheck, 'key', LIMITS.list),
    rosterModes: z
      .array(RosterMode)
      .max(ROSTER_MODES.length)
      .refine((ms) => new Set(ms.map((m) => m.mode)).size === ms.length, 'Duplicate roster mode')
      .default([]),
    text: TextBlock.optional(),
    tags: Tags,
  })
  .meta({ id: 'RulesetProfile' });

/** Pack-supplied Forge warnings (DESIGN §7). */
export const CalibrationProfile = z
  .strictObject({
    id: LocalId,
    name: Name,
    /** Rulesets this calibration targets; empty = any. */
    rulesets: list(Ref, 8),
    checks: uniqueList(FieldCheck, 'key', LIMITS.list),
    /** Flag values outside [p, 100-p] percentile of loaded official cards. */
    outliers: z
      .strictObject({ fields: z.array(UnitField).min(1).max(UNIT_FIELDS.length), percentile: int(1, 49) })
      .optional(),
    text: TextBlock.optional(),
    tags: Tags,
  })
  .meta({ id: 'CalibrationProfile' });

export type Count = z.infer<typeof Count>;
export type UnitField = z.infer<typeof UnitField>;
export type UnitSelector = z.infer<typeof UnitSelector>;
export type FieldCheck = z.infer<typeof FieldCheck>;
export type RosterModeKey = z.infer<typeof RosterModeKey>;
export type RosterMode = z.infer<typeof RosterMode>;
export type RulesetProfile = z.infer<typeof RulesetProfile>;
export type CalibrationProfile = z.infer<typeof CalibrationProfile>;
