import { describe, expect, it } from 'vitest';
import { diffStates } from './preview';
import { startGemini } from './__fixtures__/gemini';

describe('diffStates (AAR preview)', () => {
  it('reports XP, ladders, team readiness, tracks, assets and new transmissions', () => {
    const { engine, campaign } = startGemini();
    const before = engine.state;
    const r = engine.preview({
      type: 'resolveAar',
      aar: { mission: 'first-light', outcome: 'success', fields: { 'recon-reported': true }, operators: { acheron: { kills: 2, fields: { casualty: 'serious' } }, voss: { kills: 1 } } },
    });
    if (!r.ok) throw new Error(r.error);
    const d = diffStates(campaign, before, r.state);
    const ach = d.operators.find((o) => o.key === 'acheron')!;
    expect(ach.xp).toEqual({ from: 0, to: 5 });
    expect(ach.ladders.map((l) => [l.ladderName, l.from.label, l.to.label, l.to.tone])).toEqual([['Medical Status', 'Fit for duty', 'Serious Wound', 'crit']]);
    expect(d.operators.find((o) => o.key === 'voss')!.xp).toEqual({ from: 0, to: 3 });
    expect(d.teams).toEqual([{ key: 'revenants', name: 'Revenants', ladders: [expect.objectContaining({ ladderName: 'Readiness' })] }]);
    expect(d.teams[0]!.ladders[0]!.to.label).toBe('RED');
    expect(d.tracks.map((t) => [t.name, t.from, t.to])).toEqual([
      ['Sector Stability', 5, 6],
      ['Escalation', 2, 3],
    ]);
    expect(d.assets.map((a) => [a.name, a.from, a.to])).toEqual([['Deck 58 Observation Post', 0, 1]]);
    expect(d.narrative.some((n) => n.source.type === 'debrief')).toBe(true);
    expect(d.empty).toBe(false);
    expect(engine.state).toBe(before); // preview never commits
  });

  it('promotion, removal, unlocks and an empty diff', () => {
    const { engine, campaign } = startGemini();
    const before = engine.state;
    expect(diffStates(campaign, before, before).empty).toBe(true);
    const r = engine.preview({
      type: 'applyManualAdjustment',
      note: 'test',
      effects: [
        { op: 'addXp', target: 'operator:skade', amount: 9 },
        { op: 'removeOperator', target: 'operator:golem-7', reason: 'destroyed' },
        { op: 'unlockMission', mission: 'pale-signal' },
        { op: 'adjustStat', target: 'operator:skade', stat: 'penalties', amount: 1 },
      ],
    });
    if (!r.ok) throw new Error(r.error);
    const d = diffStates(campaign, before, r.state);
    const skade = d.operators.find((o) => o.key === 'skade')!;
    expect(skade.rank).toEqual({ from: 'Operator', to: 'Tier 1' });
    expect(skade.stats).toEqual([{ name: 'Permanent Penalties', from: 0, to: 1 }]);
    expect(d.operators.find((o) => o.key === 'golem-7')!.removed).toBe('destroyed');
    expect(d.missions).toEqual([{ key: 'pale-signal', name: 'PALE SIGNAL — Investigation', from: 'locked', to: 'available' }]);
  });
});
