import type { Campaign, Objective } from '$lib/packs/schema';
import type { CampaignCommandInput } from '$lib/domain/campaign';
import { rowProblems, rowToEffect, type EffectRow } from './effects';

// Custom mission form ↔ addCustomMission. AAR fields and outcomes come from campaign.customMission (engine-side).

export interface ObjectiveDraft {
  text: string;
  primary: boolean;
  points: number | undefined;
}

export interface CustomMissionDraft {
  name: string;
  briefing: string;
  /** Persona key voicing the briefing; '' = unattributed. */
  speaker: string;
  objectives: ObjectiveDraft[];
  rewards: EffectRow[];
}

export const blankCustomMission = (campaign: Campaign): CustomMissionDraft => ({
  name: '',
  briefing: '',
  speaker: campaign.personas[0]?.key ?? '',
  objectives: [{ text: '', primary: true, points: undefined }],
  rewards: [],
});

export function validateCustomMission(d: CustomMissionDraft): string[] {
  const out: string[] = [];
  if (!d.name.trim()) out.push('Name the mission.');
  if (d.name.trim().length > 80) out.push('Mission name: 80 characters at most.');
  if (d.briefing.includes('{{') || d.briefing.includes('}}')) out.push('Briefing: remove {{ }} placeholders.');
  for (const r of d.rewards) {
    const p = rowProblems(r);
    if (p) out.push(`Reward: ${p}`);
  }
  return [...new Set(out)];
}

export function toCustomMissionCommand(d: CustomMissionDraft, stage?: string): Extract<CampaignCommandInput, { type: 'addCustomMission' }> {
  const objectives: Objective[] = d.objectives
    .filter((o) => o.text.trim())
    .map((o, i) => ({ key: `obj-${i + 1}`, text: o.text.trim(), primary: o.primary, ...(o.points === undefined ? {} : { points: o.points }) }));
  const briefing = d.briefing.trim();
  return {
    type: 'addCustomMission',
    ...(stage ? { stage } : {}),
    mission: {
      name: d.name.trim(),
      ...(briefing ? { briefing: { text: briefing, tags: [], ...(d.speaker ? { speaker: d.speaker } : {}) } } : {}),
      objectives,
      rewards: d.rewards.map(rowToEffect),
      tags: [],
    },
  };
}

/** What the custom AAR will ask for (shown on the form so the player knows). */
export function customAarSummary(campaign: Campaign): { fields: string[]; outcomes: string[] } {
  const tpl = campaign.customMission;
  return {
    fields: (tpl?.aar.fields ?? []).filter((f) => f.key !== 'participated' && f.key !== 'kills').map((f) => f.label),
    outcomes: tpl?.outcomes?.map((o) => o.name) ?? ['Success', 'Failure'],
  };
}
