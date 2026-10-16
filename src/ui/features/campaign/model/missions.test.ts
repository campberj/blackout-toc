import { describe, expect, it } from 'vitest';
import { launchRequest, missionCards, scenarioId, scenarioOf } from './missions';
import { previewText, resolveNarrative } from './narrative';
import { startGemini } from './__fixtures__/gemini';

describe('missionCards (GEMINI W1)', () => {
  it('cards for available missions with briefing preview, objectives and slot', () => {
    const { engine, campaign, registry } = startGemini();
    const cards = missionCards(campaign, engine.state, engine.availableMissions(), registry);
    expect(cards.map((c) => c.key)).toEqual(['first-light', 'tripwire']);
    const fl = cards[0]!;
    expect(fl).toMatchObject({ name: 'FIRST LIGHT — Void Clearance', slotLabel: 'Primary', optional: false, tableSize: '36×36 in', rounds: 5 });
    expect(fl.preview.startsWith('Intent: sweep and secure')).toBe(true);
    expect(fl.preview.length).toBeLessThanOrEqual(181);
    expect(fl.objectives.find((o) => o.primary)?.text).toMatch(/observation post/);
  });
  it('inline scenarios have no launch id', () => {
    const { campaign, registry } = startGemini();
    const def = campaign.missions[0]!;
    expect(scenarioId(campaign, def)).toBeUndefined();
    expect(scenarioOf(campaign, def, registry)?.roundLimit).toBe(5);
    expect(scenarioId(campaign, { ...def, scenario: 'raid' })).toBe('blackfall-gemini:raid');
    expect(scenarioOf(campaign, { ...def, scenario: 'raid' }, registry)).toBeNull();
    expect(scenarioOf(campaign, { ...def, scenario: undefined } as never)).toBeNull();
  });
});

describe('narrative previews', () => {
  it('drops headers/classification, blanks vars, truncates on a word', () => {
    expect(previewText('/// MONOLITH — X ///\nCLASSIFICATION: R.\n\nHello {{campaign.stage}} team.\n\nMore.')).toBe('Hello … team.');
    const long = previewText('word '.repeat(80), 30);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(31);
  });
  it('resolves keys and inline bodies', () => {
    const { campaign } = startGemini();
    expect(resolveNarrative(campaign, 'first-light-brief')).toMatchObject({ title: 'FIRST LIGHT', speaker: 'monolith' });
    expect(resolveNarrative(campaign, { text: 'x', tags: [] })).toEqual({ title: null, text: 'x', speaker: null });
    expect(resolveNarrative(campaign, 'missing')).toBeNull();
    expect(resolveNarrative(campaign, undefined)).toBeNull();
  });
});

describe('launchRequest', () => {
  it('maps selected active operators; unknown keys dropped', () => {
    const { engine, campaign } = startGemini();
    const req = launchRequest(campaign, engine.state, 'save-1', 'first-light', ['acheron', 'golem-7', 'ghost']);
    expect(req).toEqual({
      campaignSaveId: 'save-1',
      mission: 'first-light',
      missionName: 'FIRST LIGHT — Void Clearance',
      operators: [
        { key: 'acheron', name: 'Sable Acheron', team: 'revenants', callsign: 'REVENANT' },
        { key: 'golem-7', name: 'GOLEM-7', team: 'ironclad' },
      ],
    });
    expect(launchRequest(campaign, engine.state, 's', 'nope', [])).toBeNull();
  });
});
