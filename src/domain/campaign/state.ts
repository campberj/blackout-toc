import type { Campaign, Id, Mission, OperatorSeed, Scalar } from '$lib/packs/schema';
import type { REMOVE_REASONS } from '$lib/packs/schema';

// Campaign state: plain JSON (no Maps/classes/Dates) so it persists, diffs, and syncs as-is.

export type RemoveReason = (typeof REMOVE_REASONS)[number];
export type MissionStatus = 'locked' | 'available' | 'active' | 'resolved';

/** Built-in stats: `xp` (addXp, promotion), `kills`, `missions` (AAR auto-increments). Defined in the schema. */
export { BUILTIN_STATS } from '../../packs/schema';

export interface HistoryEntry {
  /** Event seq that caused it. */
  seq: number;
  kind: 'joined' | 'mission' | 'xp' | 'stat' | 'ladder' | 'rank' | 'removed' | 'updated';
  text: string;
}

export interface OperatorState {
  key: string;
  name: string;
  callsign: string | null;
  unit: Id | null;
  team: string;
  status: 'active' | 'removed';
  removal: { reason: RemoveReason; seq: number } | null;
  /** Built-ins (xp, kills, missions) + roster.stats. */
  stats: Record<string, number>;
  rank: string | null;
  /** Operator-scope ladder key → state key. */
  ladders: Record<string, string>;
  fields: Record<string, Scalar>;
  tags: string[];
  history: HistoryEntry[];
}

export interface TeamState {
  key: string;
  name: string;
  callsign: string | null;
  text: string | null;
  tags: string[];
  /** Operator keys in join order (includes removed). */
  operators: string[];
  /** Team-scope ladder key → state key. */
  ladders: Record<string, string>;
  assets: Record<string, number>;
}

export interface MissionState {
  status: MissionStatus;
  outcome: string | null;
  resolutions: number;
  /** Stage placement outside the timeline slots (unlockMission.stage / custom missions). */
  stage: string | null;
  custom: boolean;
  notes: string | null;
}

export interface TrackState {
  value: number;
  /** Milestone keys that have fired at least once. */
  fired: string[];
}

export interface Speaker {
  key: string;
  name: string;
  callsign: string | null;
}

export type FeedSource =
  | 'intro'
  | 'briefing'
  | 'debrief'
  | 'outcome'
  | 'trigger'
  | 'milestone'
  | 'table'
  | 'effect'
  | 'stage'
  | 'mission'
  | 'manual'
  | 'roster'
  | 'engine';

export interface FeedEntry {
  id: number;
  /** Event seq that produced it. */
  seq: number;
  /** narrative = authored text; system = engine log line; filtered = withheld by content filter. */
  kind: 'narrative' | 'system' | 'filtered' | 'warning' | 'error';
  title: string | null;
  text: string;
  speaker: Speaker | null;
  source: { type: FeedSource; key: string | null };
}

export interface PendingChoice {
  key: string;
  kind: 'placeOperator';
  prompt: string;
  /** Name already rolled so the prompt can address them. */
  operator: OperatorSeed;
  /** Team the effect originally targeted. */
  team: string;
  seq: number;
}

export interface CampaignState {
  status: 'new' | 'active' | 'complete';
  campaign: Id | null;
  /** packId → version at campaign start (replay/migration drift check). */
  packs: Record<string, string>;
  seed: number;
  rngState: number;
  stage: string | null;
  stageIndex: number;
  /** Sticky once the stage's endWhen passed or all required slots resolved; cleared on advance. */
  stageComplete: boolean;
  activeMission: string | null;
  /** Status the active mission had before beginMission (restored on cancel). */
  activeMissionPrior: MissionStatus | null;
  missions: Record<string, MissionState>;
  customMissions: Record<string, { stage: string; mission: Mission }>;
  teams: Record<string, TeamState>;
  /** Team keys in creation order. */
  teamOrder: string[];
  operators: Record<string, OperatorState>;
  /** Campaign-scope ladder key → state key. */
  ladders: Record<string, string>;
  pools: Record<string, number>;
  tracks: Record<string, TrackState>;
  flags: Record<string, Scalar>;
  /** Campaign-level assets (grantAsset without team). */
  assets: Record<string, number>;
  /** Keys of `once` triggers that have fired. */
  firedTriggers: string[];
  excludedTags: string[];
  feed: FeedEntry[];
  pending: PendingChoice[];
  counters: { operator: number; feed: number; choice: number; custom: number };
}

export const initialCampaignState = (): CampaignState => ({
  status: 'new',
  campaign: null,
  packs: {},
  seed: 0,
  rngState: 0,
  stage: null,
  stageIndex: -1,
  stageComplete: false,
  activeMission: null,
  activeMissionPrior: null,
  missions: {},
  customMissions: {},
  teams: {},
  teamOrder: [],
  operators: {},
  ladders: {},
  pools: {},
  tracks: {},
  flags: {},
  assets: {},
  firedTriggers: [],
  excludedTags: [],
  feed: [],
  pending: [],
  counters: { operator: 0, feed: 0, choice: 0, custom: 0 },
});

/** Qualify a pack-source Ref against the campaign's pack (loader may or may not have qualified it). */
export const qualify = (campaignId: string, ref: string): Id =>
  (ref.includes(':') ? ref : `${campaignId.split(':')[0]}:${ref}`) as Id;

export const missionDef = (campaign: Campaign, state: CampaignState, key: string): Mission | undefined =>
  campaign.missions.find((m) => m.key === key) ?? state.customMissions[key]?.mission;

/** Operators of a team, active only, in join order. */
export const activeTeamOperators = (state: CampaignState, team: string): OperatorState[] =>
  (state.teams[team]?.operators ?? []).map((k) => state.operators[k]!).filter((o) => o?.status === 'active');

export const activeOperators = (state: CampaignState): OperatorState[] =>
  state.teamOrder.flatMap((t) => activeTeamOperators(state, t));
