import type { Campaign, OperatorSeed, Scalar } from '$lib/packs/schema';
import type { ContentLookup } from '$lib/domain/content';
import type { CreateCampaignInput } from '$lib/app';

// New-campaign wizard: draft state, validation mirroring the engine's start rules, → create input.

export interface RecruitDraft {
  /** Blank = the engine rolls a name from the roster name table. */
  name: string;
  callsign: string;
  fields: Record<string, Scalar>;
}

export interface WizardDraft {
  campaignId: string;
  faction: string | null;
  /** Picked starting team keys, in pick order. */
  teams: string[];
  recruits: Record<string, RecruitDraft[]>;
  name: string;
}

export type WizardStep = 'campaign' | 'faction' | 'teams' | 'confirm';

export interface CampaignOption {
  id: string;
  name: string;
  summary: string | null;
  packId: string;
}

export const campaignOptions = (lookup: ContentLookup): CampaignOption[] =>
  lookup.list('campaign').map((c) => ({ id: c.id, name: c.name, summary: c.summary ?? null, packId: c.id.slice(0, c.id.indexOf(':')) }));

/** Steps for this campaign (faction only when the campaign defines factions). */
export const wizardSteps = (campaign: Campaign | undefined): WizardStep[] =>
  campaign?.factions?.length ? ['campaign', 'faction', 'teams', 'confirm'] : ['campaign', 'teams', 'confirm'];

export function initWizard(campaign: Campaign): WizardDraft {
  const { startingTeams, pick } = campaign.roster;
  // Exactly-N picks (or one team on offer) are preselected: nothing to decide.
  const auto = pick.min !== undefined && pick.min === pick.max && pick.min >= startingTeams.length;
  const factions = campaign.factions ?? [];
  return {
    campaignId: campaign.id,
    faction: factions.length === 1 ? factions[0]!.key : null,
    teams: auto || startingTeams.length === 1 ? startingTeams.map((t) => t.key) : [],
    recruits: {},
    name: campaign.name,
  };
}

export function toggleTeam(draft: WizardDraft, key: string): WizardDraft {
  return { ...draft, teams: draft.teams.includes(key) ? draft.teams.filter((k) => k !== key) : [...draft.teams, key] };
}

export const blankRecruit = (campaign: Campaign): RecruitDraft => ({
  name: '',
  callsign: '',
  fields: Object.fromEntries(campaign.roster.operatorFields.filter((f) => f.default !== undefined).map((f) => [f.key, f.default!])),
});

export function teamSize(campaign: Campaign, draft: WizardDraft, team: string): number {
  const def = campaign.roster.startingTeams.find((t) => t.key === team);
  return (def?.operators.length ?? 0) + (draft.recruits[team]?.length ?? 0);
}

/** Room for another recruit in this team. */
export function canRecruit(campaign: Campaign, draft: WizardDraft, team: string): boolean {
  const max = campaign.roster.operatorsPerTeam?.max;
  return max === undefined || teamSize(campaign, draft, team) < max;
}

export function pickRule(campaign: Campaign): string {
  const { min, max } = campaign.roster.pick;
  if (min !== undefined && min === max) return `Pick ${min} team${min === 1 ? '' : 's'}.`;
  if (min !== undefined && max !== undefined) return `Pick ${min} to ${max} teams.`;
  if (min !== undefined) return `Pick at least ${min} team${min === 1 ? '' : 's'}.`;
  if (max !== undefined) return `Pick up to ${max} team${max === 1 ? '' : 's'}.`;
  return 'Pick your teams.';
}

/** Problems per step; empty = the step can be left. Mirrors the engine's start checks. */
export function validateStep(campaign: Campaign, draft: WizardDraft, step: WizardStep): string[] {
  const out: string[] = [];
  if (step === 'faction' && campaign.factions?.length && !campaign.factions.some((f) => f.key === draft.faction)) out.push('Pick a faction.');
  if (step === 'teams') {
    const { pick, teamsMax, operatorsPerTeam: per } = campaign.roster;
    const n = draft.teams.length;
    if ((pick.min !== undefined && n < pick.min) || (pick.max !== undefined && n > pick.max)) out.push(pickRule(campaign));
    if (teamsMax !== undefined && n > teamsMax) out.push(`At most ${teamsMax} teams.`);
    for (const t of draft.teams) {
      const def = campaign.roster.startingTeams.find((d) => d.key === t);
      const size = teamSize(campaign, draft, t);
      if (per?.min !== undefined && size < per.min) out.push(`${def?.name ?? t}: at least ${per.min} operators.`);
      if (per?.max !== undefined && size > per.max) out.push(`${def?.name ?? t}: at most ${per.max} operators.`);
    }
  }
  if (step === 'confirm' && !draft.name.trim()) out.push('Name the save.');
  return out;
}

export const validateAll = (campaign: Campaign, draft: WizardDraft): string[] => wizardSteps(campaign).flatMap((s) => validateStep(campaign, draft, s));

const seedOf = (r: RecruitDraft): OperatorSeed => ({
  ...(r.name.trim() ? { name: r.name.trim() } : {}),
  ...(r.callsign.trim() ? { callsign: r.callsign.trim() } : {}),
  ...(Object.keys(r.fields).length ? { fields: r.fields } : {}),
  tags: [],
});

/** Create input. `faction` rides along for campaigns that define factions. */
export function toCreateInput(draft: WizardDraft): CreateCampaignInput & { faction?: string } {
  return {
    name: draft.name.trim(),
    campaign: draft.campaignId as CreateCampaignInput['campaign'],
    teams: draft.teams.map((key) => ({ key, recruits: (draft.recruits[key] ?? []).map(seedOf) })),
    ...(draft.faction ? { faction: draft.faction } : {}),
  };
}
