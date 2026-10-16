import type { Campaign, Id, InlineScenario, Mission, Objective } from '$lib/packs/schema';
import type { ContentLookup } from '$lib/domain/content';
import type { GameLaunchRequest } from '$lib/app';
import { missionDef, qualify, type CampaignState, type MissionView } from '$lib/domain/campaign';
import { previewText, resolveNarrative } from './narrative';

// Mission cards for the operations center and the briefing screen's static parts.

export interface MissionCard {
  key: string;
  name: string;
  preview: string;
  objectives: Objective[];
  slotLabel: string | null;
  optional: boolean;
  custom: boolean;
  repeatable: boolean;
  resolutions: number;
  tableSize: string | null;
  rounds: number | null;
}

const slotLabel = (campaign: Campaign, s: CampaignState, v: MissionView) => {
  const stage = campaign.timeline.stages.find((st) => st.key === (v.stage ?? s.stage));
  const slot = stage?.slots.find((sl) => sl.key === v.slot);
  return slot ? { label: slot.label ?? slot.key, optional: slot.optional } : null;
};

/** Inline scenario, or the referenced one from loaded content (null when absent/unloaded). */
export function scenarioOf(campaign: Campaign, def: Mission, lookup?: ContentLookup): InlineScenario | null {
  if (def.scenario === undefined) return null;
  if (typeof def.scenario !== 'string') return def.scenario;
  return lookup?.get('scenario', qualify(campaign.id, def.scenario) as Id) ?? null;
}

export function missionCards(campaign: Campaign, s: CampaignState, available: readonly MissionView[], lookup?: ContentLookup): MissionCard[] {
  return available.flatMap((v) => {
    const def = missionDef(campaign, s, v.key);
    if (!def) return [];
    const brief = resolveNarrative(campaign, def.briefing);
    const sc = scenarioOf(campaign, def, lookup);
    const slot = slotLabel(campaign, s, v);
    return [
      {
        key: v.key,
        name: def.name,
        preview: brief ? previewText(brief.text) : '',
        objectives: def.objectives,
        slotLabel: slot?.label ?? (v.custom ? 'Custom' : null),
        optional: slot?.optional ?? false,
        custom: v.custom,
        repeatable: v.repeatable,
        resolutions: v.resolutions,
        tableSize: sc ? `${sc.tableSize.width}×${sc.tableSize.depth} ${sc.tableSize.unit}` : null,
        rounds: sc?.roundLimit ?? null,
      },
    ];
  });
}

/** Launch request scenario id: only referenced (not inline) scenarios have one. */
export const scenarioId = (campaign: Campaign, def: Mission): string | undefined =>
  typeof def.scenario === 'string' ? qualify(campaign.id, def.scenario) : undefined;

/** Dashboard launch request for the chosen participants. */
export function launchRequest(campaign: Campaign, s: CampaignState, saveId: string, mission: string, selected: readonly string[]): GameLaunchRequest | null {
  const def = missionDef(campaign, s, mission);
  if (!def) return null;
  const id = scenarioId(campaign, def);
  return {
    campaignSaveId: saveId,
    mission,
    missionName: def.name,
    ...(id ? { scenarioId: id } : {}),
    operators: selected.flatMap((k) => {
      const o = s.operators[k];
      if (!o || o.status !== 'active') return [];
      return [{ key: k, name: o.name, team: o.team, ...(o.callsign ? { callsign: o.callsign } : {}), ...(o.unit ? { unitId: o.unit } : {}) }];
    }),
  };
}
