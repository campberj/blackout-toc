import { describe, expect, it } from 'vitest';
import { renderTemplate, resolveVar, speakerOf, showNarrative, FILTERED_TEXT } from './narrative';
import { ctxFor, ironEngine, scope } from './__fixtures__/harness';

describe('templates', () => {
  it('renders known, empty (null), and unknown vars', () => {
    const vals: Record<string, string | number | null> = { a: 1, b: null };
    expect(renderTemplate('{{a}}|{{ b }}|{{c.d}}', (p) => vals[p])).toBe('1||[?c.d]');
  });

  it('resolves the documented variable context', () => {
    const ctx = ctxFor(ironEngine());
    const s = ctx.s;
    s.operators.vale!.ladders.wounds = 'light';
    s.teams.alpha!.assets.uav = 2;
    s.assets.uav = 1;
    s.flags.hot = 'yes';
    s.activeMission = 'recon';
    s.missions.recon!.outcome = 'success';
    const sc = scope({ subject: 'vale', mission: 'recon' });
    const r = (p: string) => resolveVar(ctx.campaign, s, sc, p);
    expect(
      [
        'operator.key', 'operator.name', 'operator.callsign', 'operator.rank', 'operator.team', 'operator.unit', 'operator.status',
        'operator.grit', 'operator.xp', 'operator.field.role', 'operator.ladder.wounds',
        'team.key', 'team.name', 'team.callsign', 'team.size', 'team.ladder.readiness', 'team.asset.uav',
        'mission.key', 'mission.name', 'mission.outcome', 'mission.status',
        'campaign.name', 'campaign.stage', 'campaign.stageKey', 'campaign.ladder.alert', 'campaign.asset.uav', 'campaign.flag.hot',
        'track.intel', 'track.intel.name', 'track.intel.max', 'pool.supply', 'pool.supply.name',
        'persona.overwatch', 'persona.actual', 'persona.overwatch.name', 'persona.overwatch.callsign', 'persona.overwatch.role',
      ].map(r),
    ).toEqual([
      'vale', 'Vale', 'KNIFE', 'Private', 'Team Alpha', 'core:rifle-team', 'active',
      3, 0, 'lead', 'Lightly Wounded',
      'alpha', 'Team Alpha', 'ANVIL', 3, 'Green', 2,
      'recon', 'Recon', 'Clean', 'available',
      'Iron Test', 'Window One', 'one', 'Calm', 1, 'yes',
      0, 'Intel', 12, 6, 'Supply',
      'OVERWATCH', 'Major Rusk', 'Overwatch', 'OVERWATCH', 'Handler',
    ]);
    const unknown = [
      'nope', 'operator', 'operator.field', 'operator.ladder', 'operator.name.x', 'team', 'team.ladder', 'team.asset', 'team.size.x', 'team.bogus',
      'mission.name.x', 'mission.bogus', 'campaign.ladder', 'campaign.asset', 'campaign.flag', 'campaign.name.x', 'campaign.bogus',
      'track.ghost', 'track.intel.bogus', 'pool.ghost', 'pool.supply.bogus', 'persona.ghost', 'persona.actual.bogus',
    ];
    expect(unknown.map(r).every((v) => v === undefined)).toBe(true);
    expect(resolveVar(ctx.campaign, s, scope(), 'operator.name')).toBeUndefined(); // no subject
    expect(resolveVar(ctx.campaign, s, scope(), 'team.name')).toBe('Team Alpha'); // first team fallback
    expect(resolveVar(ctx.campaign, { ...s, activeMission: null }, scope(), 'mission.name')).toBeUndefined();
    expect(resolveVar(ctx.campaign, s, scope({ subject: 'brook' }), 'operator.callsign')).toBeNull();
    s.operators.brook!.rank = null;
    expect(resolveVar(ctx.campaign, s, scope({ subject: 'brook' }), 'operator.rank')).toBeNull();
    expect(resolveVar(ctx.campaign, s, scope({ mission: 'hunt' }), 'mission.outcome')).toBeNull();
    expect(resolveVar(ctx.campaign, s, scope(), 'persona.actual.callsign')).toBeNull();
    expect(speakerOf(ctx.campaign, 'ghost')).toBeNull();
    expect([r('campaign.faction'), r('campaign.factionName')]).toEqual([null, null]);
    s.faction = 'rogue'; // key not in campaign.factions → key as name
    expect([r('campaign.faction'), r('campaign.factionName')]).toEqual(['rogue', 'rogue']);
  });

  it('applies the content filter and narrative `when`', () => {
    const ctx = ctxFor(ironEngine());
    showNarrative(ctx, scope(), 'gory');
    expect(ctx.s.feed.at(-1)).toMatchObject({ kind: 'filtered', text: FILTERED_TEXT });
    const n = ctx.s.feed.length;
    showNarrative(ctx, scope(), 'gated');
    expect(ctx.s.feed).toHaveLength(n);
    ctx.s.flags['show-gated'] = true;
    showNarrative(ctx, scope(), 'gated');
    expect(ctx.s.feed.at(-1)!.text).toBe('Only when flagged.');
    ctx.s.excludedTags = [];
    showNarrative(ctx, scope(), 'gory');
    expect(ctx.s.feed.at(-1)).toMatchObject({ kind: 'narrative', text: 'Graphic.' });
  });
});
