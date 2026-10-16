import type { Campaign } from '$lib/packs/schema';
import type { CampaignState } from '$lib/domain/campaign';

// Stage header: where we are on the timeline and how many required slots are done.

export interface SlotView {
  key: string;
  label: string;
  optional: boolean;
  resolved: boolean;
  /** Mission names that can fill the slot. */
  missions: string[];
}

export interface StageView {
  key: string;
  name: string;
  /** 1-based. */
  number: number;
  total: number;
  slots: SlotView[];
  required: number;
  resolvedRequired: number;
  /** Engine's sticky completion flag (required slots done or endWhen passed). */
  complete: boolean;
  /** Stage ends on a pack condition rather than slots alone. */
  hasEndCondition: boolean;
  allowCustomMissions: boolean;
  /** Last stage: advancing completes the campaign. */
  last: boolean;
}

export function stageView(campaign: Campaign, s: CampaignState): StageView | null {
  const stage = campaign.timeline.stages[s.stageIndex];
  if (!stage) return null;
  const name = (k: string) => campaign.missions.find((m) => m.key === k)?.name ?? k;
  const slots = stage.slots.map((sl) => ({
    key: sl.key,
    label: sl.label ?? sl.key,
    optional: sl.optional,
    resolved: sl.missions.some((m) => (s.missions[m]?.resolutions ?? 0) > 0),
    missions: sl.missions.map(name),
  }));
  const req = slots.filter((x) => !x.optional);
  return {
    key: stage.key,
    name: stage.name,
    number: s.stageIndex + 1,
    total: campaign.timeline.stages.length,
    slots,
    required: req.length,
    resolvedRequired: req.filter((x) => x.resolved).length,
    complete: s.stageComplete,
    hasEndCondition: stage.endWhen !== undefined,
    allowCustomMissions: stage.allowCustomMissions,
    last: s.stageIndex === campaign.timeline.stages.length - 1,
  };
}
