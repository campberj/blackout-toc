import { z } from 'zod';
import { int, Key, list, LocalId, LongText, Name, Ref, ShortText, Tag, Tags, TextBlock, uniqueList } from './common';
import { RosterModeKey } from './rules';

const Named = { key: Key, name: Name, text: TextBlock.optional() };

export const ScenarioSide = z
  .strictObject({
    ...Named,
    rosterMode: RosterModeKey.optional(),
    /** Fixed forces (e.g. hostiles / third-party AI). */
    units: list(z.strictObject({ unit: Ref, count: int(1, 20).default(1) }), 16),
    /** Behaviour flags for AI-controlled sides. */
    behavior: list(Tag, 16),
  })
  .meta({ id: 'ScenarioSide' });

export const ScoringTiming = z
  .strictObject({
    when: z.enum(['immediate', 'end-of-round', 'end-of-game']),
    /** Restrict to specific rounds (e.g. POI control at rounds 2 and 4). */
    rounds: z.array(int(1, 12)).max(12).optional(),
  })
  .meta({ id: 'ScoringTiming' });

export const ScoringRule = z
  .strictObject({
    key: Key,
    /** Event label the dashboard logs (e.g. `kill`, `poi-control`, `extract`). */
    event: Key,
    label: Name,
    points: int(-99, 99),
    timing: ScoringTiming.prefault({ when: 'immediate' }),
    /** Cap on times this can score per player. */
    max: int(1, 99).optional(),
    side: Key.optional(),
    text: TextBlock.optional(),
  })
  .meta({ id: 'ScoringRule' });

const scenarioShape = {
  name: Name,
  lore: LongText.optional(),
  tableSize: z.strictObject({ width: int(6, 120), depth: int(6, 120), unit: z.enum(['in', 'cm']).default('in') }),
  roundLimit: int(1, 12),
  hardpoints: int(0, 12).default(0),
  pois: uniqueList(z.strictObject(Named), 'key', 16),
  forces: z.strictObject({
    symmetric: z.boolean().default(true),
    sides: uniqueList(ScenarioSide, 'key', 4),
  }),
  deployment: z.strictObject({
    text: TextBlock,
    zones: list(z.strictObject({ side: Key, text: ShortText }), 8),
  }),
  specialRules: uniqueList(z.strictObject(Named), 'key', 16),
  scoring: uniqueList(ScoringRule, 'key', 32),
  endConditions: uniqueList(z.strictObject({ key: Key, text: ShortText }), 'key', 8),
  scoreLabel: Name.default('VP'),
  campaignReward: TextBlock.optional(),
  tags: Tags,
};

export const Scenario = z.strictObject({ id: LocalId, ...scenarioShape }).meta({ id: 'Scenario' });
/** Scenario embedded in a mission (no id). */
export const InlineScenario = z.strictObject(scenarioShape).meta({ id: 'InlineScenario' });

export type ScenarioSide = z.infer<typeof ScenarioSide>;
export type ScoringTiming = z.infer<typeof ScoringTiming>;
export type ScoringRule = z.infer<typeof ScoringRule>;
export type Scenario = z.infer<typeof Scenario>;
export type InlineScenario = z.infer<typeof InlineScenario>;
