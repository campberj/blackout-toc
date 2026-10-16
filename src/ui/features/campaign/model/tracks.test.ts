import { describe, expect, it } from 'vitest';
import { assetViews, flagViews, humanize, poolViews, trackViews } from './tracks';
import { startGemini } from './__fixtures__/gemini';
import { initialCampaignState } from '$lib/domain/campaign';

describe('track views (GEMINI)', () => {
  it('one segment per point with milestone ticks on boundaries', () => {
    const { engine, campaign } = startGemini();
    const [stability, escalation, intel] = trackViews(campaign, engine.state);
    expect(stability).toMatchObject({ name: 'Sector Stability', value: 5, min: 1, max: 10 });
    expect(stability!.segments).toHaveLength(9);
    expect(stability!.segments.filter((x) => x.filled).map((x) => x.value)).toEqual([2, 3, 4, 5]);
    expect(stability!.ticks).toEqual([{ key: 'secure', at: 8, pos: 7 / 9, fired: false, reached: false }]);
    expect(escalation!.next?.key).toBe('special-operations');
    expect(intel!.segments).toHaveLength(15);
    expect(intel!.ticks.map((t) => t.at)).toEqual([5, 10, 15]);
  });

  it('pools, held assets, raised flags only', () => {
    const { engine, campaign } = startGemini();
    expect(poolViews(campaign, engine.state).map((p) => [p.name, p.value, p.max])).toEqual([
      ["Butcher's Bill (KIA)", 0, null],
      ['Windows Since Reinforcement Review', 0, 4],
    ]);
    expect(assetViews(campaign, engine.state).map((a) => a.name)).toEqual(['STRATCOM SIGINT', 'Authority QRF', 'Medical Evacuation']);
    expect(flagViews(engine.state)).toEqual([]); // golems-committed=false is bookkeeping
    const s = { ...initialCampaignState(), flags: { 'op-secured': true, count: 2, off: false, none: 0, blank: '' } };
    expect(flagViews(s)).toEqual([
      { key: 'op-secured', label: 'Op secured', value: 'Yes' },
      { key: 'count', label: 'Count', value: '2' },
    ]);
    expect(humanize('a_b-c')).toBe('A b c');
  });

  it('team-held assets are labelled with the team', () => {
    const { engine, campaign } = startGemini();
    const s = structuredClone(engine.state);
    s.teams['revenants']!.assets['golem-upgrade'] = 1;
    expect(assetViews(campaign, s).at(-1)).toMatchObject({ name: 'Golem Upgrade Package', team: 'Revenants' });
  });
});
