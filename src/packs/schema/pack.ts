import { z } from 'zod';
import { LIMITS, Name, Ref, Semver, SemverRange, ShortText, Slug, Tags, TextBlock, uniqueList } from './common';
import { Faction, ForceCard, Keyword, UnitCard } from './cards';
import { CalibrationProfile, RulesetProfile } from './rules';
import { Scenario } from './scenario';
import { Campaign, Table } from './campaign';

export const PACK_FORMAT = 'blkout-pack';
export const PACK_FORMAT_VERSION = 2;
/** Accepted versions; v2 is a strict superset of v1 (no migration). v2-only features in a v1 pack are a loader error. */
export const PACK_FORMAT_VERSIONS = [1, 2] as const;

/** Content arrays keyed by pack-content kind; one entry per kind keeps errata + loader generic. */
export const CONTENT_KINDS = {
  keyword: Keyword,
  faction: Faction,
  force: ForceCard,
  unit: UnitCard,
  ruleset: RulesetProfile,
  calibration: CalibrationProfile,
  scenario: Scenario,
  table: Table,
  campaign: Campaign,
} as const;
export type ContentKind = keyof typeof CONTENT_KINDS;

/** Kind → PackContent array key. Declared once so every loader pass stays kind-generic. */
export const CONTENT_KEYS = {
  keyword: 'keywords',
  faction: 'factions',
  force: 'forces',
  unit: 'units',
  ruleset: 'rulesets',
  calibration: 'calibrations',
  scenario: 'scenarios',
  table: 'tables',
  campaign: 'campaigns',
} as const satisfies Record<ContentKind, Exclude<keyof z.input<typeof PackContent>, 'errata'>>;

type AnyObject = z.ZodObject<z.ZodRawShape>;

/** Unwrap default/prefault so a patch never injects defaults over the target's values. */
const stripDefault = (s: z.ZodType): z.ZodType =>
  s instanceof z.ZodDefault || s instanceof z.ZodPrefault || s instanceof z.ZodOptional ? stripDefault(s.unwrap() as z.ZodType) : s;

/**
 * Shallow patch: any top-level field except `id`, all optional, no defaults.
 * The loader (WP2) merges and re-validates the result against the full schema.
 */
const patchOf = <T extends AnyObject>(schema: T) => {
  const shape = Object.fromEntries(
    Object.entries(schema.shape)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => [k, stripDefault(v as z.ZodType).optional()]),
  );
  return z
    .strictObject(shape)
    .refine((p) => Object.keys(p).length > 0, 'Patch must set at least one field') as unknown as z.ZodType<
    Partial<Omit<z.output<T>, 'id'>>,
    Partial<Omit<z.input<T>, 'id'>>
  >;
};

const errataFor = <K extends ContentKind>(kind: K) =>
  z.strictObject({
    kind: z.literal(kind),
    /** Usually cross-pack, so normally qualified. */
    target: Ref,
    note: ShortText.optional(),
    set: patchOf(CONTENT_KINDS[kind] as unknown as AnyObject) as z.ZodType<
      Partial<Omit<z.output<(typeof CONTENT_KINDS)[K]>, 'id'>>,
      Partial<Omit<z.input<(typeof CONTENT_KINDS)[K]>, 'id'>>
    >,
  });

export const Errata = z
  .discriminatedUnion('kind', [
    errataFor('keyword'),
    errataFor('faction'),
    errataFor('force'),
    errataFor('unit'),
    errataFor('ruleset'),
    errataFor('calibration'),
    errataFor('scenario'),
    errataFor('table'),
    errataFor('campaign'),
  ])
  .meta({ id: 'Errata' });

const content = <T extends z.ZodType>(item: T) => uniqueList(item, 'id', LIMITS.content);

export const PackContent = z
  .strictObject({
    keywords: content(Keyword),
    factions: content(Faction),
    forces: content(ForceCard),
    units: content(UnitCard),
    rulesets: content(RulesetProfile),
    calibrations: content(CalibrationProfile),
    scenarios: content(Scenario),
    tables: content(Table),
    campaigns: content(Campaign),
    errata: z.array(Errata).max(LIMITS.content).default([]),
  })
  .meta({ id: 'PackContent' });

export const PackDependency = z.strictObject({ id: Slug, range: SemverRange }).meta({ id: 'PackDependency' });

export const Pack = z
  .strictObject({
    $schema: z.string().max(512).optional(),
    format: z.literal(PACK_FORMAT),
    formatVersion: z.literal(PACK_FORMAT_VERSIONS),
    /** Pack id = namespace for every local id inside. `user` is reserved for Forge output. */
    id: Slug,
    version: Semver,
    title: Name,
    author: Name,
    license: ShortText.optional(),
    description: TextBlock.optional(),
    requires: uniqueList(PackDependency, 'id', 32),
    contentTags: Tags,
    content: PackContent.prefault({}),
  })
  .meta({ id: 'Pack', title: 'BLKOUT: TOC data pack' });

export type Errata = z.infer<typeof Errata>;
export type PackContent = z.infer<typeof PackContent>;
export type PackDependency = z.infer<typeof PackDependency>;
export type Pack = z.infer<typeof Pack>;
export type PackInput = z.input<typeof Pack>;
