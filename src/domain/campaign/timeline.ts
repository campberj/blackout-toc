import type { Campaign, MissionSlot, Stage } from '$lib/packs/schema';
import { missionDef, type CampaignState } from './state';

// Read-only timeline queries (linear topology). Shared by decider, reducer and façade.

export const currentStage = (campaign: Campaign, s: CampaignState): Stage | undefined => campaign.timeline.stages[s.stageIndex];

/** First slot (in timeline order) that lists the mission. */
export function slotOf(campaign: Campaign, key: string): { stage: Stage; slot: MissionSlot } | undefined {
  for (const stage of campaign.timeline.stages) {
    const slot = stage.slots.find((sl) => sl.missions.includes(key));
    if (slot) return { stage, slot };
  }
  return undefined;
}

/** Explicit placement (unlockMission.stage / custom) wins over slot placement; null = floating (any stage). */
export const missionStage = (campaign: Campaign, s: CampaignState, key: string): string | null =>
  s.missions[key]?.stage ?? slotOf(campaign, key)?.stage.key ?? null;

export const slotResolved = (s: CampaignState, slot: MissionSlot) => slot.missions.some((m) => (s.missions[m]?.resolutions ?? 0) > 0);

/** All non-optional slots of the current stage have a resolved mission. */
export function slotsComplete(campaign: Campaign, s: CampaignState): boolean {
  const stage = currentStage(campaign, s);
  return !!stage && stage.slots.every((sl) => sl.optional || slotResolved(s, sl));
}

export interface MissionView {
  key: string;
  name: string;
  stage: string | null;
  slot: string | null;
  status: CampaignState['missions'][string]['status'];
  custom: boolean;
  repeatable: boolean;
  resolutions: number;
}

/** Missions that `beginMission` accepts right now, in timeline order then custom order. */
export function availableMissions(campaign: Campaign, s: CampaignState): MissionView[] {
  if (s.status !== 'active' || s.activeMission) return [];
  const out: MissionView[] = [];
  for (const key of Object.keys(s.missions)) {
    const ms = s.missions[key]!;
    const def = missionDef(campaign, s, key);
    if (!def) continue;
    const stage = missionStage(campaign, s, key);
    if (stage !== null && stage !== s.stage) continue;
    const beginnable = ms.status === 'available' || (ms.status === 'resolved' && def.repeatable);
    if (!beginnable) continue;
    // A slot resolved by any of its candidates closes the others (player chose), unless explicitly re-placed.
    const placed = slotOf(campaign, key);
    const slotted = ms.stage === null && placed !== undefined;
    if (slotted && slotResolved(s, placed.slot) && !(def.repeatable && ms.resolutions > 0)) continue;
    out.push({
      key,
      name: def.name,
      stage,
      slot: slotted ? placed.slot.key : null,
      status: ms.status,
      custom: ms.custom,
      repeatable: def.repeatable,
      resolutions: ms.resolutions,
    });
  }
  const order = (k: string) => {
    const i = campaign.missions.findIndex((m) => m.key === k);
    return i < 0 ? campaign.missions.length + Object.keys(s.customMissions).indexOf(k) : i;
  };
  return out.sort((a, b) => order(a.key) - order(b.key));
}
