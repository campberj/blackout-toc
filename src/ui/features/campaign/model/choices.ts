import type { Campaign } from '$lib/packs/schema';
import type { CampaignState, PendingChoice } from '$lib/domain/campaign';

// Pending player choices → option buttons for resolveChoice.

export interface ChoiceOption {
  /** resolveChoice option value: `team:<key>` or `discard`. */
  value: string;
  label: string;
  disabled: boolean;
  reason: string | null;
  /** The team the effect originally targeted. */
  suggested: boolean;
}

export interface ChoiceView {
  key: string;
  prompt: string;
  operatorName: string;
  options: ChoiceOption[];
}

export function choiceView(campaign: Campaign, s: CampaignState, c: PendingChoice): ChoiceView {
  const max = campaign.roster.operatorsPerTeam?.max;
  const teams = s.teamOrder.map((k): ChoiceOption => {
    const t = s.teams[k]!;
    const size = t.operators.filter((o) => s.operators[o]?.status === 'active').length;
    const full = max !== undefined && size >= max;
    return { value: `team:${k}`, label: `Assign to ${t.name}`, disabled: full, reason: full ? `${t.name} is at full strength (${size}/${max})` : null, suggested: k === c.team };
  });
  return {
    key: c.key,
    prompt: c.prompt,
    operatorName: c.operator.name ?? 'Recruit',
    options: [...teams, { value: 'discard', label: 'Decline', disabled: false, reason: null, suggested: false }],
  };
}

export const choiceViews = (campaign: Campaign, s: CampaignState): ChoiceView[] => s.pending.map((c) => choiceView(campaign, s, c));
