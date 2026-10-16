import { z } from 'zod';
import {
  Effect,
  Id,
  InlineScenario,
  int,
  Key,
  Mission,
  Name,
  NarrativeRef,
  Objective,
  OperatorSeed,
  Ref,
  Scalar,
  Semver,
  ShortText,
  Slug,
  Tags,
  TextBlock,
} from '$lib/packs/schema';
import type { DomainEvent } from '../events';

// Commands are Zod-validated (UI input is untrusted); persisted event payloads reuse the same schemas.

const Effects1 = z.array(Effect).min(1).max(64);

/** A starting team picked from `roster.startingTeams`, plus any extra recruits the player adds. */
export const TeamPick = z.strictObject({ key: Key, recruits: z.array(OperatorSeed).max(24).default([]) });

export const StartCampaign = z.strictObject({
  type: z.literal('startCampaign'),
  campaign: Id,
  /** Supplied by the app (domain never reads entropy). */
  seed: z.number().int().min(0).max(0xffffffff),
  teams: z.array(TeamPick).min(1).max(32),
  /** packId → version, as reported by the loader; recorded for replay/migration checks. */
  packs: z.record(Slug, Semver).default({}),
  excludedTags: Tags,
  /** v2: campaign.factions key; required when the campaign defines factions. */
  faction: Key.optional(),
});

export const AarOperator = z.strictObject({
  participated: z.boolean().default(true),
  kills: int(0, 999).default(0),
  /** Operator-scope pack AAR fields. */
  fields: z.record(Key, Scalar).default({}),
  notes: ShortText.optional(),
});

export const Aar = z.strictObject({
  mission: Key,
  outcome: Key,
  operators: z.record(Key, AarOperator).default({}),
  /** Mission-scope pack AAR fields. */
  fields: z.record(Key, Scalar).default({}),
  notes: TextBlock.optional(),
});

export const CustomMissionInput = z.strictObject({
  name: Name,
  scenario: z.union([Ref, InlineScenario]).optional(),
  briefing: NarrativeRef.optional(),
  objectives: z.array(Objective).max(16).default([]),
  /** Applied on the `success` outcome; `failure` has no effects. */
  rewards: z.array(Effect).max(64).default([]),
  tags: Tags,
});

const cmd = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) => z.strictObject({ type: z.literal(type), ...shape });

export const CampaignCommand = z.discriminatedUnion('type', [
  StartCampaign,
  cmd('beginMission', { mission: Key }),
  cmd('cancelMission', {}),
  cmd('resolveAar', { aar: Aar }),
  /** `force` skips the stage-complete check (GM override). */
  cmd('advanceStage', { force: z.boolean().default(false) }),
  /** stage absent = current stage. */
  cmd('addCustomMission', { stage: Key.optional(), mission: CustomMissionInput }),
  cmd('rollRandomEvent', { table: Ref }),
  /** GM override: any effect list, logged with a note. `subject` binds the `subject` target. */
  cmd('applyManualAdjustment', { effects: Effects1, note: ShortText.min(1), subject: Key.optional() }),
  /** option = `team:<key>` or `discard`. */
  cmd('resolveChoice', { choice: Key, option: z.string().max(80) }),
  /** Sheet data only (no mechanics). */
  cmd('updateOperator', { operator: Key, name: Name.optional(), callsign: Name.nullable().optional(), fields: z.record(Key, Scalar).optional() }),
  cmd('setContentFilter', { excludedTags: Tags }),
]);

export type CampaignCommandInput = z.input<typeof CampaignCommand>;
export type CampaignCommand = z.output<typeof CampaignCommand>;
export type CommandOf<T extends CampaignCommand['type']> = Extract<CampaignCommand, { type: T }>;
export type StartCampaignInput = z.input<typeof StartCampaign>;
export type Aar = z.output<typeof Aar>;
export type AarInput = z.input<typeof Aar>;

// ── Events ───────────────────────────────────────────────────────────────
const payloadOf = <T extends CampaignCommand['type']>(t: T) =>
  (CampaignCommand.options.find((o) => o.shape.type.value === t)! as unknown as z.ZodObject).omit({ type: true });

/** Persisted event payload schemas (validate logs loaded from storage). Intent-level: effects are re-derived on replay. */
export const EVENT_PAYLOADS = {
  CampaignStarted: StartCampaign.omit({ type: true }),
  MissionBegun: payloadOf('beginMission'),
  MissionCancelled: z.strictObject({ mission: Key }),
  AarResolved: payloadOf('resolveAar'),
  StageAdvanced: payloadOf('advanceStage'),
  CustomMissionAdded: z.strictObject({ stage: Key, mission: Mission }),
  RandomEventRolled: payloadOf('rollRandomEvent'),
  ManualAdjustmentApplied: payloadOf('applyManualAdjustment'),
  ChoiceResolved: payloadOf('resolveChoice'),
  OperatorUpdated: payloadOf('updateOperator'),
  ContentFilterSet: payloadOf('setContentFilter'),
} as const;

type Payload<T extends CampaignCommand['type']> = Omit<CommandOf<T>, 'type'>;

export type CampaignEvent =
  | DomainEvent<'CampaignStarted', Payload<'startCampaign'>>
  | DomainEvent<'MissionBegun', Payload<'beginMission'>>
  | DomainEvent<'MissionCancelled', { mission: string }>
  | DomainEvent<'AarResolved', Payload<'resolveAar'>>
  | DomainEvent<'StageAdvanced', Payload<'advanceStage'>>
  | DomainEvent<'CustomMissionAdded', { stage: string; mission: Mission }>
  | DomainEvent<'RandomEventRolled', Payload<'rollRandomEvent'>>
  | DomainEvent<'ManualAdjustmentApplied', Payload<'applyManualAdjustment'>>
  | DomainEvent<'ChoiceResolved', Payload<'resolveChoice'>>
  | DomainEvent<'OperatorUpdated', Payload<'updateOperator'>>
  | DomainEvent<'ContentFilterSet', Payload<'setContentFilter'>>;

export type CampaignEventType = CampaignEvent['type'];
export type EventPayload<T extends CampaignEventType> = Extract<CampaignEvent, { type: T }>['payload'];
export const CAMPAIGN_EVENT_TYPES = Object.keys(EVENT_PAYLOADS) as CampaignEventType[];

/** Validate a persisted event's payload against its schema. */
export function validateEvent(e: Pick<DomainEvent, 'seq' | 'type' | 'payload'>): string | undefined {
  const schema = (EVENT_PAYLOADS as Record<string, z.ZodType>)[e.type];
  if (!schema) return `Unknown event type "${e.type}"`;
  const r = schema.safeParse(e.payload);
  return r.success ? undefined : `Event ${e.seq} (${e.type}): ${formatIssues(r.error)}`;
}

export const formatIssues = (err: z.ZodError): string =>
  err.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`).join('; ');
