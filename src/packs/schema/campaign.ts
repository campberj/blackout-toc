import { z } from 'zod';
import { Count } from './rules';
import { int, Key, LIMITS, list, LocalId, LongText, Name, Ref, Scalar, ShortText, Tags, TextBlock, uniqueList } from './common';
import { Condition, Effects, narrativeBody, NarrativeBlock, NarrativeRef, TeamDef } from './dsl';
import { InlineScenario } from './scenario';

// The seven campaign primitives (DESIGN §6) + missions and triggers.
// Keys inside a campaign are campaign-scoped slugs; cross-pack refs (units, tables, scenarios) use Ref.

/** Stats every operator has regardless of pack (engine-maintained). Shared by loader validation and engine. */
export const BUILTIN_STATS = ['xp', 'kills', 'missions'] as const;

export const TRIGGER_EVENTS = [
  'onCampaignStart',
  'onStageStart',
  'onMissionStart',
  'onMissionResolved',
  'onStageEnd',
  'onTrackMilestone',
  'onOperatorKia',
] as const;
export const TriggerEvent = z.enum(TRIGGER_EVENTS);

const when = () => Condition.optional();

// ── Roster ───────────────────────────────────────────────────────────────
export const FieldKind = z.enum(['boolean', 'number', 'choice', 'text']);

/** Typed form field; shared by operator templates and AAR config. */
const fieldShape = {
  key: Key,
  label: Name,
  kind: FieldKind,
  options: z.array(z.strictObject({ value: Key, label: Name })).max(LIMITS.list).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  default: Scalar.optional(),
  help: ShortText.optional(),
};
const choiceNeedsOptions = (f: { kind: string; options?: unknown[] | undefined }) => f.kind !== 'choice' || (f.options?.length ?? 0) > 0;
const CHOICE_MSG = { message: "kind 'choice' requires options", path: ['options'] };

export const FieldDef = z.strictObject(fieldShape).refine(choiceNeedsOptions, CHOICE_MSG).meta({ id: 'FieldDef' });

export const StatDef = z
  .strictObject({ key: Key, name: Name, initial: int(-9999, 9999).default(0), min: int(-9999, 9999).optional(), max: int(-9999, 9999).optional() })
  .meta({ id: 'StatDef' });

export const RankDef = z.strictObject({ key: Key, name: Name, xp: int(0, 99999).optional() }).meta({ id: 'RankDef' });

export const RosterDef = z
  .strictObject({
    /** Player picks `pick` teams from these at campaign start. */
    startingTeams: uniqueList(TeamDef, 'key', 16),
    pick: Count.prefault({ min: 1, max: 1 }),
    teamsMax: int(1, 32).optional(),
    operatorsPerTeam: Count.optional(),
    /** Built-in per-operator stats: `xp` (addXp) and `kills`; declare others here. */
    stats: uniqueList(StatDef, 'key', 16),
    /** Operator template fields (free-form sheet data). */
    operatorFields: uniqueList(FieldDef, 'key', 16),
    ranks: uniqueList(RankDef, 'key', 16),
    nameTable: Ref.optional(),
  })
  .meta({ id: 'RosterDef' });

// ── Ladder ───────────────────────────────────────────────────────────────
export const Ladder = z
  .strictObject({
    key: Key,
    name: Name,
    /** operator = one state per operator (injury); team / campaign = single shared state (readiness). */
    scope: z.enum(['operator', 'team', 'campaign']).default('operator'),
    /** Ordered; stepLadder moves along this order. */
    states: uniqueList(
      z.strictObject({ key: Key, name: Name, text: ShortText.optional(), onEnter: Effects, tags: Tags }),
      'key',
      16,
    ).check(z.minLength(2)),
    initial: Key,
    /** Extra effects when moving from→to ('*' = any). */
    transitions: list(z.strictObject({ from: z.union([Key, z.literal('*')]), to: Key, when: when(), effects: Effects }), 32),
  })
  .refine((l) => l.states.some((s) => s.key === l.initial), { message: 'initial must be a state key', path: ['initial'] })
  .refine(
    (l) => l.transitions.every((t) => [t.from, t.to].every((k) => k === '*' || l.states.some((s) => s.key === k))),
    { message: 'transition references unknown state', path: ['transitions'] },
  )
  .meta({ id: 'Ladder' });

// ── Pool ─────────────────────────────────────────────────────────────────
export const Pool = z
  .strictObject({
    key: Key,
    name: Name,
    initial: int(-9999, 9999).default(0),
    min: int(-9999, 9999).default(0),
    max: int(-9999, 9999).optional(),
    refresh: list(
      z.strictObject({ on: TriggerEvent, mode: z.enum(['set', 'add']), amount: int(-9999, 9999), when: when() }),
      8,
    ),
  })
  .meta({ id: 'Pool' });

// ── Track ────────────────────────────────────────────────────────────────
export const Milestone = z
  .strictObject({
    key: Key,
    at: int(-999, 999),
    /** Fire once ever (default) or every time the track crosses `at` upward. */
    once: z.boolean().default(true),
    effects: Effects,
    narrative: NarrativeRef.optional(),
  })
  .meta({ id: 'Milestone' });

export const Track = z
  .strictObject({
    key: Key,
    name: Name,
    min: int(-999, 999).default(0),
    max: int(-999, 999),
    initial: int(-999, 999).default(0),
    milestones: uniqueList(Milestone, 'key', 32),
  })
  .refine((t) => t.min <= t.initial && t.initial <= t.max, { message: 'initial must be within min..max', path: ['initial'] })
  .refine((t) => t.milestones.every((m) => m.at >= t.min && m.at <= t.max), { message: 'milestone outside min..max', path: ['milestones'] })
  .meta({ id: 'Track' });

// ── Table ────────────────────────────────────────────────────────────────
export const TableEntry = z
  .strictObject({
    key: Key,
    weight: int(1, 1000),
    label: Name,
    narrative: z.strictObject(narrativeBody).optional(),
    effects: Effects,
    when: when(),
    tags: Tags,
  })
  .refine((e) => e.effects.length > 0 || e.narrative !== undefined, 'Entry needs effects and/or narrative')
  .meta({ id: 'TableEntry' });

/** Pack-level (content.tables) so campaigns and scenarios can share them. */
export const Table = z
  .strictObject({ id: LocalId, name: Name, text: TextBlock.optional(), entries: uniqueList(TableEntry, 'key', 200).check(z.minLength(1)), tags: Tags })
  .meta({ id: 'Table' });

// ── Mission ──────────────────────────────────────────────────────────────
export const AarField = z
  .strictObject({
    ...fieldShape,
    scope: z.enum(['mission', 'operator']),
    /** Effects when the field equals a value. Operator-scope: `subject` = that operator. */
    onValue: list(z.strictObject({ value: Scalar, effects: Effects }), 16),
    /** Number fields: effects applied once per unit (e.g. per kill). */
    perUnit: Effects,
  })
  .refine(choiceNeedsOptions, CHOICE_MSG)
  .meta({ id: 'AarField' });

export const Objective = z
  .strictObject({ key: Key, text: ShortText, primary: z.boolean().default(false), points: int(-99, 99).optional() })
  .meta({ id: 'Objective' });

export const MissionOutcome = z
  .strictObject({ key: Key, name: Name, effects: Effects, narrative: NarrativeRef.optional() })
  .meta({ id: 'MissionOutcome' });

export const Mission = z
  .strictObject({
    key: Key,
    name: Name,
    /** Scenario id, or an inline scenario. */
    scenario: z.union([Ref, InlineScenario]).optional(),
    briefing: NarrativeRef.optional(),
    debrief: NarrativeRef.optional(),
    objectives: uniqueList(Objective, 'key', 16),
    /** Engine always records outcome, per-operator `participated`, and notes; these add to it. */
    aar: z.strictObject({ fields: uniqueList(AarField, 'key', 24) }).prefault({}),
    outcomes: uniqueList(MissionOutcome, 'key', 8).check(z.minLength(1)),
    locked: z.boolean().default(false),
    repeatable: z.boolean().default(false),
    tags: Tags,
  })
  .meta({ id: 'Mission' });

// ── Timeline ─────────────────────────────────────────────────────────────
export const MissionSlot = z
  .strictObject({
    key: Key,
    label: Name.optional(),
    /** Candidate missions; player chooses among unlocked ones. */
    missions: z.array(Key).min(1).max(16),
    optional: z.boolean().default(false),
  })
  .meta({ id: 'MissionSlot' });

export const Stage = z
  .strictObject({
    key: Key,
    name: Name,
    briefing: NarrativeRef.optional(),
    slots: uniqueList(MissionSlot, 'key', 16),
    allowCustomMissions: z.boolean().default(true),
    /** Stage ends early when true; otherwise when all non-optional slots resolve. */
    endWhen: when(),
  })
  .meta({ id: 'Stage' });

export const Timeline = z
  .strictObject({
    /** F5 seam; only `linear` is implemented. */
    topology: z.enum(['linear', 'nodes', 'map']).default('linear'),
    stages: uniqueList(Stage, 'key', 32).check(z.minLength(1)),
  })
  .meta({ id: 'Timeline' });

// ── Triggers ─────────────────────────────────────────────────────────────
export const Trigger = z
  .strictObject({
    key: Key,
    on: TriggerEvent,
    /** Narrow the event (stage/mission/track/milestone keys). */
    filter: z
      .strictObject({ stage: Key.optional(), mission: Key.optional(), track: Key.optional(), milestone: Key.optional() })
      .optional(),
    when: when(),
    once: z.boolean().default(false),
    effects: Effects,
    narrative: NarrativeRef.optional(),
  })
  .meta({ id: 'Trigger' });

export const Persona = z
  .strictObject({ key: Key, name: Name, callsign: Name.optional(), role: ShortText.optional(), text: ShortText.optional() })
  .meta({ id: 'Persona' });

export const Campaign = z
  .strictObject({
    id: LocalId,
    name: Name,
    summary: TextBlock.optional(),
    intro: LongText.optional(),
    rulesets: list(Ref, 8),
    personas: uniqueList(Persona, 'key', 16),
    roster: RosterDef,
    timeline: Timeline,
    missions: uniqueList(Mission, 'key', 200),
    ladders: uniqueList(Ladder, 'key', 16),
    pools: uniqueList(Pool, 'key', 16),
    tracks: uniqueList(Track, 'key', 16),
    narratives: uniqueList(NarrativeBlock, 'key', 500),
    triggers: uniqueList(Trigger, 'key', 200),
    assets: uniqueList(z.strictObject({ key: Key, name: Name, text: ShortText.optional() }), 'key', 64),
    tags: Tags,
  })
  .meta({ id: 'Campaign' });

export type TriggerEvent = z.infer<typeof TriggerEvent>;
export type FieldDef = z.infer<typeof FieldDef>;
export type StatDef = z.infer<typeof StatDef>;
export type RankDef = z.infer<typeof RankDef>;
export type RosterDef = z.infer<typeof RosterDef>;
export type Ladder = z.infer<typeof Ladder>;
export type Pool = z.infer<typeof Pool>;
export type Milestone = z.infer<typeof Milestone>;
export type Track = z.infer<typeof Track>;
export type TableEntry = z.infer<typeof TableEntry>;
export type Table = z.infer<typeof Table>;
export type AarField = z.infer<typeof AarField>;
export type Objective = z.infer<typeof Objective>;
export type MissionOutcome = z.infer<typeof MissionOutcome>;
export type Mission = z.infer<typeof Mission>;
export type MissionSlot = z.infer<typeof MissionSlot>;
export type Stage = z.infer<typeof Stage>;
export type Timeline = z.infer<typeof Timeline>;
export type Trigger = z.infer<typeof Trigger>;
export type Persona = z.infer<typeof Persona>;
export type Campaign = z.infer<typeof Campaign>;
