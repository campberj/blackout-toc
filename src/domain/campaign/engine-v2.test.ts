import { describe, expect, it } from 'vitest';
import { createCampaignEngine, replayCampaign, type CampaignEngine } from './index';
import { content, feedText, IRON, must } from './__fixtures__/harness';

const V2 = 'ops:v2-test' as const;
const start = (faction?: string, seed = 7): CampaignEngine => {
  const e = createCampaignEngine(content());
  const r = e.start({ campaign: V2, seed, teams: [{ key: 'alpha' }, { key: 'bravo' }], ...(faction ? { faction } : {}) });
  if (!r.ok) throw new Error(r.error);
  return e;
};
const op = (e: CampaignEngine, outcome: string, ops: string[] = []) =>
  must(e, { type: 'resolveAar', aar: { mission: 'op', outcome, operators: Object.fromEntries(ops.map((k) => [k, {}])) } });

describe('golden: v2 extensions', () => {
  it('faction, target filters, forEachTeam + teamMissions, onPromotion, byFaction, destroyed, custom template', () => {
    const e = start('shade');
    const s0 = e.state;
    expect(s0.faction).toBe('shade');
    expect(feedText(s0)).toContain('Shade Cell (shade) online.');

    // Filtered addXp: only medics (a1 in alpha) gain; a1 promotes → onPromotion(rank cpl) fires once.
    op(e, 'success', ['a1', 'a2']);
    expect([e.state.operators.a1!.stats.xp, e.state.operators.a2!.stats.xp]).toEqual([3, 0]);
    expect(e.state.operators.a1!.rank).toBe('cpl');
    expect(feedText(e.state)).toContain('Ash made Corporal.');
    expect(e.state.pools.supply).toBe(6);
    expect(e.state.flags.table).toBe('shade'); // byFaction override

    // Third mission in the window for alpha → RED; bravo (1 mission) stays green.
    op(e, 'success', ['a2', 'b1']);
    op(e, 'success', ['a2']);
    expect(e.state.teamStageMissions.w1).toEqual({ alpha: 3, bravo: 1 });
    expect([e.state.teams.alpha!.ladders.readiness, e.state.teams.bravo!.ladders.readiness]).toEqual(['red', 'green']);
    expect(e.state.pools.supply).toBe(6); // a1 not a participant: no further promotion

    // rally: per team, `team` target steps the loop team's ladder; filter excludes medics.
    op(e, 'rally');
    expect([e.state.teams.alpha!.ladders.readiness, e.state.teams.bravo!.ladders.readiness]).toEqual(['red', 'amber']);
    expect(['a1', 'a2', 'b1', 'b2'].map((k) => e.state.operators[k]!.stats.kills)).toEqual([0, 1, 1, 0]);

    // destroyed: filter by tag; does not fire onOperatorKia.
    op(e, 'scrap');
    expect(e.state.operators.b1).toMatchObject({ status: 'removed', removal: { reason: 'destroyed' } });
    expect(e.state.flags).not.toHaveProperty('kia-fired');

    // Custom mission uses the campaign template (AAR fields + outcomes; rewards appended to `success`).
    must(e, { type: 'addCustomMission', mission: { name: 'Salvage', rewards: [{ op: 'adjustPool', pool: 'supply', amount: 10 }] } });
    const custom = e.state.customMissions['custom-1']!.mission;
    expect(custom.outcomes.map((o) => o.key)).toEqual(['win', 'success', 'loss']);
    expect(custom.aar.fields.map((f) => f.key)).toEqual(['loot']);
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'custom-1', outcome: 'success', fields: { loot: -1 } } }).ok).toBe(false);
    must(e, { type: 'resolveAar', aar: { mission: 'custom-1', outcome: 'success', fields: { loot: 2 } } });
    expect(e.state.pools.supply).toBe(18);
    expect(e.state.flags.clean).toBe(true);

    // New stage: per-stage counts start fresh.
    must(e, { type: 'advanceStage' });
    op(e, 'success', ['a2']);
    expect(e.state.teamStageMissions.w2).toEqual({ alpha: 1 });

    expect({ ...e.state, feed: feedText(e.state) }).toMatchSnapshot();
    expect(replayCampaign(content(), JSON.parse(JSON.stringify(e.events)))).toEqual(e.state);
  });

  it('byFaction falls back to the default table; faction validation at start', () => {
    const e = start('vanguard');
    op(e, 'success');
    expect(e.state.flags.table).toBe('default');
    const f = createCampaignEngine(content());
    const base = { campaign: V2 as `${string}:${string}`, seed: 1, teams: [{ key: 'alpha' }] };
    expect(f.start(base)).toMatchObject({ ok: false, error: 'Pick a faction' });
    expect(f.start({ ...base, faction: 'nope' })).toMatchObject({ ok: false, error: 'Unknown faction "nope"' });
    expect(f.start({ ...base, campaign: IRON, faction: 'shade' })).toMatchObject({ ok: false, error: 'Unknown faction "shade"' });
  });
});
