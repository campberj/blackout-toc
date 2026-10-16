/**
 * Contract between the game dashboard (F3) and the campaign UI (F4). Owned by the architect;
 * changing it needs a check-in. Lets both features be built in parallel without importing each other.
 */

/** Campaign → dashboard: start a tracked game for a campaign mission. */
export interface GameLaunchRequest {
  campaignSaveId: string;
  /** Campaign mission key (or custom mission key). */
  mission: string;
  missionName: string;
  /** Scenario content id when the mission references one (qualified). */
  scenarioId?: string;
  /** Operators the player selected for this mission. */
  operators: readonly LaunchOperator[];
}

export interface LaunchOperator {
  /** Campaign operator key; carried on the dashboard model so results map back. */
  key: string;
  name: string;
  callsign?: string;
  team: string;
  /** Unit card id when known (qualified); otherwise the dashboard shows a generic model. */
  unitId?: string;
}

/** Dashboard → campaign: what the tracked game observed. The AAR form pre-fills from this; the player edits. */
export interface AarPrefill {
  campaignSaveId: string;
  mission: string;
  /** Suggested from VP/objectives if the dashboard can tell; the player confirms. */
  outcome?: string;
  operators: Readonly<Record<string, OperatorObservation>>;
  rounds: number;
  notes: string;
}

export interface OperatorObservation {
  participated: boolean;
  kills: number;
  /** What the table showed; pack casualty rolls are still resolved in the AAR form. */
  status: 'ok' | 'damaged' | 'down' | 'destroyed';
}

/** Implemented by the session service (WP7); consumed by the campaign UI (WP8). */
export interface GameCampaignBridge {
  /** Creates a dashboard session; returns its id (navigate to #/dashboard?session=<id>). */
  launch(req: GameLaunchRequest): Promise<string>;
  /** Pending result for a campaign mission, if a linked session has ended. */
  prefillFor(campaignSaveId: string, mission: string): Promise<AarPrefill | undefined>;
  /** Clear after the AAR is resolved. */
  consume(campaignSaveId: string, mission: string): Promise<void>;
}
