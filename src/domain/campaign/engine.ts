import type { ContentLookup } from '../content';
import { createEventStore, replay, type DispatchResult, type StoredEvent } from '../events';
import { validateEvent, type CampaignCommandInput, type CampaignEvent, type StartCampaignInput } from './commands';
import { createCampaignDecider } from './decider';
import { createCampaignReducer } from './reducer';
import { initialCampaignState, type CampaignState } from './state';
import { availableMissions, type MissionView } from './timeline';

export type CampaignDispatchResult = DispatchResult<CampaignState, CampaignEvent>;

/**
 * Solo campaign engine façade (DESIGN §6).
 *
 * Event-sourced: every accepted command appends one or more intent events; state is always
 * `replay(initialCampaignState(), events, reducer)`. Effects are re-derived on replay from
 * content + rngState, so the log stays small and migrations/sync only deal with intents.
 */
export interface CampaignEngine {
  /** Shorthand for `dispatch({ type: 'startCampaign', ... })`. */
  start(input: Omit<StartCampaignInput, 'type'>, opts?: { at?: string }): CampaignDispatchResult;
  /** Validate a command against current state; on success append its events and update state. */
  dispatch(command: CampaignCommandInput, opts?: { at?: string }): CampaignDispatchResult;
  /** Dry-run a command: the resulting state/events without committing (e.g. AAR preview). */
  preview(command: CampaignCommandInput): CampaignDispatchResult;
  /** Remove every event of the last dispatched command and rebuild state. */
  undo(): CampaignState;
  /** Truncate the log to `seq` (keep `seq <= n`) and rebuild state. */
  truncate(seq: number): CampaignState;
  /** Replace the log with persisted events (payloads validated; legacy events without `cmd` = one command each). */
  load(events: readonly StoredEvent<CampaignEvent>[]): { ok: true; state: CampaignState } | { ok: false; error: string };
  /** Missions `beginMission` accepts now. */
  availableMissions(): MissionView[];
  readonly state: CampaignState;
  readonly events: readonly CampaignEvent[];
}

/** Pure reducer for consumers that replay logs themselves (persistence, sync, tests). */
export const campaignReducer = createCampaignReducer;

/** Replay a full log from scratch. */
export const replayCampaign = (content: ContentLookup, events: readonly CampaignEvent[]): CampaignState =>
  replay(initialCampaignState(), events, createCampaignReducer(content));

export function createCampaignEngine(content: ContentLookup): CampaignEngine {
  const store = createEventStore<CampaignState, CampaignCommandInput, CampaignEvent>({
    init: initialCampaignState(),
    reduce: createCampaignReducer(content),
    decide: createCampaignDecider(content),
  });
  return {
    start: (input, opts) => store.dispatch({ ...input, type: 'startCampaign' }, opts),
    dispatch: (command, opts) => store.dispatch(command, opts),
    preview: (command) => store.preview(command),
    undo: () => store.undo(),
    truncate: (seq) => store.truncate(seq),
    load(events) {
      for (const e of events) {
        const err = validateEvent(e);
        if (err) return { ok: false, error: err };
      }
      return store.load(events);
    },
    availableMissions() {
      const s = store.state;
      const campaign = s.campaign ? content.get('campaign', s.campaign) : undefined;
      return campaign ? availableMissions(campaign, s) : [];
    },
    get state() {
      return store.state;
    },
    get events() {
      return store.events;
    },
  };
}
