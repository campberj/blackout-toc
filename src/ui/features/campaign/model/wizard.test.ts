import { describe, expect, it } from 'vitest';
import { blankRecruit, campaignOptions, canRecruit, initWizard, pickRule, toCreateInput, toggleTeam, validateAll, validateStep, wizardSteps } from './wizard';
import { geminiContent } from './__fixtures__/gemini';
import type { Campaign } from '$lib/packs/schema';

describe('wizard model (GEMINI)', () => {
  const { registry, campaign } = geminiContent();

  it('lists loaded campaigns and adds a faction step only when needed', () => {
    expect(campaignOptions(registry)).toEqual([expect.objectContaining({ id: 'blackfall-gemini:cold-iron', packId: 'blackfall-gemini' })]);
    expect(wizardSteps(campaign)).toEqual(['campaign', 'faction', 'teams', 'confirm']);
    expect(wizardSteps({ ...campaign, factions: undefined } as Campaign)).toEqual(['campaign', 'teams', 'confirm']);
    expect(wizardSteps(undefined)).toEqual(['campaign', 'teams', 'confirm']);
  });

  it('pick-exactly-all preselects teams; single faction preselects', () => {
    const d = initWizard(campaign);
    expect(d).toMatchObject({ faction: 'rfa', teams: ['revenants', 'pale-horse', 'ironclad'], name: campaign.name });
    expect(validateAll(campaign, d)).toEqual([]);
    expect(pickRule(campaign)).toBe('Pick 3 teams.');
  });

  it('validates pick counts, team sizes, faction and name', () => {
    let d = toggleTeam(initWizard(campaign), 'ironclad');
    expect(validateStep(campaign, d, 'teams')).toEqual(['Pick 3 teams.']);
    d = toggleTeam(d, 'ironclad');
    d = { ...d, recruits: { revenants: [blankRecruit(campaign), blankRecruit(campaign)] } };
    expect(validateStep(campaign, d, 'teams')).toEqual(['Revenants: at most 3 operators.']);
    expect(canRecruit(campaign, d, 'revenants')).toBe(false);
    expect(canRecruit(campaign, d, 'pale-horse')).toBe(true);
    expect(validateStep(campaign, { ...d, faction: null }, 'faction')).toEqual(['Pick a faction.']);
    expect(validateStep(campaign, { ...d, name: '  ' }, 'confirm')).toEqual(['Name the save.']);
  });

  it('pick rules read naturally', () => {
    const r = (min?: number, max?: number) => pickRule({ ...campaign, roster: { ...campaign.roster, pick: { min, max } } } as Campaign);
    expect([r(1, 2), r(2), r(undefined, 2), r(), r(1, 1)]).toEqual(['Pick 1 to 2 teams.', 'Pick at least 2 teams.', 'Pick up to 2 teams.', 'Pick your teams.', 'Pick 1 team.']);
  });

  it('create input: blank recruit names are left for the name table; faction carried', () => {
    const d = initWizard(campaign);
    const named = { ...blankRecruit(campaign), name: ' Kade ', callsign: 'ASH' };
    const input = toCreateInput({ ...d, name: ' Gemini ', recruits: { revenants: [named], 'pale-horse': [blankRecruit(campaign)] } });
    expect(input.name).toBe('Gemini');
    expect(input.faction).toBe('rfa');
    expect(input.teams[0]!.recruits![0]).toMatchObject({ name: 'Kade', callsign: 'ASH', tags: [] });
    expect(input.teams[1]!.recruits![0]!.name).toBeUndefined();
    expect(input.teams[1]!.recruits![0]!.fields).toMatchObject({ grade: 'Sgt.' });
  });
});
