import { describe, expect, it } from 'vitest';
import { historyGroups, memorial, selectionWarnings, stageAtSeq, teamViews } from './roster';
import { startGemini } from './__fixtures__/gemini';

describe('roster views (GEMINI)', () => {
  it('teams → operators with rank, xp, badges, custom stats and tags', () => {
    const { engine, campaign } = startGemini();
    const teams = teamViews(campaign, engine.state);
    expect(teams.map((t) => [t.name, t.callsign, t.size, t.maxSize, t.badges.map((b) => b.label)])).toEqual([
      ['Revenants', 'GEMINI 1', 2, 3, ['GREEN']],
      ['Pale Horse', 'GEMINI 2', 2, 3, ['GREEN']],
      ['Ironclad', 'GEMINI 3', 2, 3, ['GREEN']],
    ]);
    const golem = teams[2]!.operators[0]!;
    expect(golem).toMatchObject({ name: 'GOLEM-7', tags: ['golem'], rankName: 'Operator', active: true });
    expect(golem.stats).toEqual([{ key: 'penalties', name: 'Permanent Penalties', value: 0 }]);
  });

  it('readiness, stage missions and memorial after a KIA', () => {
    const { engine, campaign } = startGemini();
    engine.dispatch({ type: 'resolveAar', aar: { mission: 'first-light', outcome: 'failure', operators: { voss: { fields: { casualty: 'kia' } }, acheron: { kills: 2 } } } });
    const s = engine.state;
    const rev = teamViews(campaign, s)[0]!;
    expect(rev.stageMissions).toBe(1);
    expect(rev.operators.map((o) => o.name)).toEqual(['Sable Acheron']);
    expect(rev.tone).toBe('crit');
    const fallen = memorial(campaign, s, engine.events);
    expect(fallen).toEqual([{ key: 'voss', name: 'Elara Voss', callsign: 'BREACH', teamName: 'Revenants', reason: 'Killed in action', stage: 'Window 1 — D+14', missions: 1 }]);
    const groups = historyGroups(s.operators['voss']!);
    expect(groups.find((g) => g.id === 'missions')!.entries).toHaveLength(1);
    expect(groups.find((g) => g.id === 'injuries')!.entries.length).toBeGreaterThan(0);
  });

  it('stageAtSeq counts stage advances before the event', () => {
    const ev = [
      { seq: 1, type: 'CampaignStarted' },
      { seq: 2, type: 'StageAdvanced' },
      { seq: 3, type: 'AarResolved' },
    ];
    expect([1, 2, 3].map((n) => stageAtSeq(ev, n))).toEqual([0, 0, 1]);
  });
});

describe('selectionWarnings', () => {
  it('flags off-green teams and hurt operators among the selection only', () => {
    const { engine, campaign } = startGemini();
    engine.dispatch({ type: 'resolveAar', aar: { mission: 'first-light', outcome: 'success', operators: { acheron: { fields: { casualty: 'serious' } } } } });
    const teams = teamViews(campaign, engine.state);
    expect(selectionWarnings(teams, ['skade'])).toEqual([]);
    expect(selectionWarnings(teams, ['acheron', 'voss'])).toEqual([
      { tone: 'crit', text: 'Revenants is RED (Readiness).' },
      { tone: 'crit', text: 'Sable Acheron: Serious Wound.' },
    ]);
  });
});
