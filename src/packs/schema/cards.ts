import { z } from 'zod';
import { Armor, int, Key, KeywordRef, list, LocalId, Name, Ref, ShortText, Tag, Tags, TextBlock, uniqueArray, uniqueList } from './common';

// Schema bounds are sanity caps only. Rules limits (Skill 4–8 …) live in RulesetProfile.unitLimits;
// style warnings live in CalibrationProfile (DESIGN §7).

export const UNIT_TYPES = ['infantry', 'handler', 'duster', 'vehicle', 'hostile'] as const;
export const UnitType = z.enum(UNIT_TYPES);

export const Keyword = z
  .strictObject({
    id: LocalId,
    name: Name,
    appliesTo: z.enum(['weapon', 'model']),
    param: z.literal('X').optional(),
    gist: ShortText,
    /** Full text per ruleset id; text drifts across Core / S8.1 / S2026 (D9). */
    byRuleset: z.record(Ref, TextBlock).optional(),
    tags: Tags,
  })
  .meta({ id: 'Keyword' });

/** Card-scoped key (weapons, rules, abilities): referenced by session events as unitId + key. */
const CardItem = { key: Key, name: Name };

export const Weapon = z
  .strictObject({
    ...CardItem,
    minRange: int(0, 96).optional(),
    maxRange: int(1, 96).optional(),
    damage: int(0, 10).optional(),
    keywords: list(KeywordRef, 16),
    usesMax: int(1, 9).optional(),
    /** Ability-style weapons with no profile (e.g. "gains Jump (4)"). */
    text: TextBlock.optional(),
  })
  .refine((w) => w.minRange === undefined || w.maxRange === undefined || w.minRange <= w.maxRange, {
    message: 'minRange must be <= maxRange',
    path: ['minRange'],
  })
  .meta({ id: 'Weapon' });

export const Ability = z
  .strictObject({ ...CardItem, cpCost: int(0, 9).optional(), usesMax: int(1, 9).optional(), text: TextBlock })
  .meta({ id: 'Ability' });

/** Unit rule; usesMax = number of limited-use boxes on the card. */
export const UnitRule = z
  .strictObject({ ...CardItem, usesMax: int(1, 9).optional(), text: TextBlock })
  .meta({ id: 'UnitRule' });

/** Specialist model; omitted stats inherit from the unit. */
export const Specialist = z
  .strictObject({
    ...CardItem,
    skill: int(2, 10).optional(),
    move: int(0, 24).optional(),
    armor: Armor.optional(),
    weapons: uniqueList(Weapon, 'key', 4),
    rules: uniqueList(UnitRule, 'key', 4),
    keywords: list(KeywordRef, 16),
  })
  .meta({ id: 'Specialist' });

export const DamageTrack = z.strictObject({ key: Key, name: Name, size: int(1, 12) });

export const UnitCard = z
  .strictObject({
    id: LocalId,
    name: Name,
    faction: Ref,
    type: UnitType,
    /** Printed card code, if any. */
    code: z.string().max(32).optional(),
    skill: int(2, 10),
    move: int(0, 24),
    armor: Armor,
    grunts: int(0, 9),
    modelCount: int(1, 20).optional(),
    combatLoads: int(0, 9),
    weapons: uniqueList(Weapon, 'key', 8),
    specialists: uniqueList(Specialist, 'key', 8),
    rules: uniqueList(UnitRule, 'key', 8),
    keywords: list(KeywordRef, 16),
    /** Absent = destroyed on first damage. */
    damageTracks: uniqueArray(DamageTrack, 'key', 4).optional(),
    /** Third-party AI behaviour flags (hostiles). */
    behavior: list(Tag, 16),
    source: z.strictObject({ edition: z.string().max(32).optional(), custom: z.boolean().optional() }).optional(),
    text: TextBlock.optional(),
    tags: Tags,
  })
  .meta({ id: 'UnitCard' });

export const ArmoryItem = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('weapon'), weapon: Weapon }),
    z.strictObject({ kind: z.literal('ability'), ability: Ability }),
  ])
  .meta({ id: 'ArmoryItem' });

export const ForceCard = z
  .strictObject({
    id: LocalId,
    name: Name,
    faction: Ref,
    forceRule: TextBlock,
    battleDrills: uniqueList(Ability, 'key', 8),
    armory: list(ArmoryItem, 12),
    dusterArmory: list(ArmoryItem, 12),
    tags: Tags,
  })
  .meta({ id: 'ForceCard' });

export const Faction = z
  .strictObject({
    id: LocalId,
    name: Name,
    code: z.string().max(16).optional(),
    side: Key.optional(),
    text: TextBlock.optional(),
    tags: Tags,
  })
  .meta({ id: 'Faction' });

export type UnitType = z.infer<typeof UnitType>;
export type Keyword = z.infer<typeof Keyword>;
export type Weapon = z.infer<typeof Weapon>;
export type Ability = z.infer<typeof Ability>;
export type UnitRule = z.infer<typeof UnitRule>;
export type Specialist = z.infer<typeof Specialist>;
export type DamageTrack = z.infer<typeof DamageTrack>;
export type UnitCard = z.infer<typeof UnitCard>;
export type ArmoryItem = z.infer<typeof ArmoryItem>;
export type ForceCard = z.infer<typeof ForceCard>;
export type Faction = z.infer<typeof Faction>;
