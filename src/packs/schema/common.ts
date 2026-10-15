import { z } from 'zod';

/** Caps protect the importer from hostile/oversized packs (DESIGN §5). */
export const LIMITS = {
  slug: 64,
  name: 80,
  short: 280,
  text: 4000,
  longText: 20000,
  list: 64,
  tags: 32,
  content: 2000,
} as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lowercase kebab slug. Used for pack ids, local ids, and campaign-scoped keys. */
export const Slug = z.string().min(1).max(LIMITS.slug).regex(SLUG_RE, 'Expected lowercase slug (a-z, 0-9, single dashes)');

/** Campaign-/card-scoped key (never namespaced). */
export const Key = Slug;

/** Bare local id as written in pack source; the loader (WP2) prefixes `packId:`. */
export const LocalId = Slug;

/** Fully qualified `packId:localId`. */
export const Id = z
  .templateLiteral([Slug, ':', Slug])
  // templateLiteral ignores per-part length checks; enforce both parts here.
  .check(z.regex(new RegExp(`^[^:]{1,${LIMITS.slug}}:[^:]{1,${LIMITS.slug}}$`), 'Id parts must be 1-64 chars'))
  .meta({ id: 'Id', description: 'Qualified id `packId:localId` (lowercase slugs).' });

/** Reference as written in pack source: bare local id (same pack) or qualified id (cross-pack). */
export const LocalOrQualifiedId = z
  .union([Id, LocalId])
  .meta({ id: 'Ref', description: 'Bare local id (same pack) or qualified `packId:localId`.' });
export const Ref = LocalOrQualifiedId;

export const Name = z.string().trim().min(1).max(LIMITS.name);
export const ShortText = z.string().max(LIMITS.short);
/** Free rules/flavour text authored by the pack owner. */
export const TextBlock = z.string().max(LIMITS.text);
export const LongText = z.string().max(LIMITS.longText);

export const Tag = Slug;
export const Tags = z.array(Tag).max(LIMITS.tags).default([]);

export const Scalar = z.union([z.boolean(), z.number(), z.string().max(LIMITS.short)]);

/** Small signed/unsigned integer helpers keep bounds explicit at call sites. */
export const int = (min: number, max: number) => z.number().int().min(min).max(max);

/** Bounded optional list that defaults to []. */
export const list = <T extends z.ZodType>(item: T, max: number = LIMITS.list) => z.array(item).max(max).default([]);

/** Bounded array whose items must have unique `field` values (no default). */
export const uniqueArray = <T extends z.ZodType>(item: T, field: 'key' | 'id' = 'key', max: number = LIMITS.list) =>
  z
    .array(item)
    .max(max)
    .superRefine((items, ctx) => {
      const seen = new Set<unknown>();
      items.forEach((it, i) => {
        const v = (it as Record<string, unknown>)[field];
        if (seen.has(v)) ctx.addIssue({ code: 'custom', message: `Duplicate ${field} "${String(v)}"`, path: [i, field] });
        seen.add(v);
      });
    });

/** uniqueArray defaulting to []. */
export const uniqueList = <T extends z.ZodType>(item: T, field: 'key' | 'id' = 'key', max: number = LIMITS.list) =>
  uniqueArray(item, field, max).default([]);

export const Range = z
  .strictObject({ min: z.number().optional(), max: z.number().optional() })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, 'min must be <= max');

export const KeywordRef = z
  .strictObject({ key: Ref, x: int(0, 99).optional() })
  .meta({ id: 'KeywordRef', description: '"Blast (1)" → {key:"core:blast", x:1}' });

export const Armor = z
  .strictObject({ dice: int(1, 3), target: int(2, 10) })
  .meta({ id: 'Armor', description: '"2/6" → {dice:2, target:6}' });

export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const Semver = z.string().max(64).regex(SEMVER_RE, 'Expected semver x.y.z');
/** npm-style range (`^1`, `>=1.2.0 <2`); parsed/evaluated by the loader. */
export const SemverRange = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[0-9xX*^~<>=|.\s-]+$/, 'Expected semver range');

export type Id = z.infer<typeof Id>;
export type Ref = z.infer<typeof Ref>;
export type Key = z.infer<typeof Key>;
export type KeywordRef = z.infer<typeof KeywordRef>;
export type Armor = z.infer<typeof Armor>;
export type Tags = z.infer<typeof Tags>;
export type Scalar = z.infer<typeof Scalar>;
export type Range = z.infer<typeof Range>;
