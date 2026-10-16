import { describe, expect, it } from 'vitest';
import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import other from '$lib/packs/loader/__fixtures__/other-demo-pack.json';
import { loadPacks } from '$lib/packs/loader';
import { createCampaignEngine, replayCampaign } from '$lib/domain/campaign';

// G2 integration: real loader → registry → engine (WP2 ↔ WP4 built in isolation).
describe('loader → engine', () => {
  const loaded = loadPacks([demo, other]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error, null, 2));
  const { registry } = loaded.value;

  it('runs a campaign end-to-end on loader output and replays identically', () => {
    const e = createCampaignEngine(registry);
    const start = e.start({ campaign: 'demo:long-night', seed: 7, packs: { demo: demo.version }, excludedTags: [], teams: [{ key: 'ember' }] });
    expect(start.ok, JSON.stringify(start)).toBe(true);
    expect(Object.keys(e.state.operators).length).toBeGreaterThan(0);

    const mission = e.availableMissions()[0];
    expect(mission).toBeDefined();
    const ops = Object.values(e.state.operators).filter((o) => o.status === 'active').map((o) => o.key);
    const res = e.dispatch({
      type: 'resolveAar',
      aar: { mission: mission!.key, outcome: 'success', operators: Object.fromEntries(ops.map((k, i) => [k, { participated: true, kills: i }])), fields: {}, notes: '' },
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    const wren = e.state.operators['wren'];
    expect(wren?.stats.missions).toBe(1);

    expect(replayCampaign(registry, e.events)).toEqual(e.state);
  });
});
