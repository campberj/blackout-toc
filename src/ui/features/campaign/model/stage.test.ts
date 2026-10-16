import { describe, expect, it } from 'vitest';
import { stageView } from './stage';
import { startGemini } from './__fixtures__/gemini';
import { initialCampaignState } from '$lib/domain/campaign';

describe('stageView', () => {
  it('Window 1: two required primary slots and an optional bonus', () => {
    const { engine, campaign } = startGemini();
    const v = stageView(campaign, engine.state)!;
    expect(v).toMatchObject({ name: 'Window 1 — D+14', number: 1, total: 12, required: 2, resolvedRequired: 0, complete: false, last: false });
    expect(v.slots.map((s) => [s.label, s.optional])).toEqual([
      ['Primary', false],
      ['Primary', false],
      ['Bonus (conditional)', true],
    ]);
    engine.dispatch({ type: 'resolveAar', aar: { mission: 'first-light', outcome: 'success', operators: { acheron: {} } } });
    expect(stageView(campaign, engine.state)!.resolvedRequired).toBe(1);
  });
  it('null before start', () => {
    const { campaign } = startGemini();
    expect(stageView(campaign, initialCampaignState())).toBeNull();
  });
});
