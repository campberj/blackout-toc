import { describe, expect, it } from 'vitest';
import type { Ladder } from '$lib/packs/schema';
import { ladderBadge, ladderTone, operatorBadges, teamBadges, worstTone } from './ladders';
import { startGemini } from './__fixtures__/gemini';

const ladder = (n: number): Ladder => ({
  key: 'l',
  name: 'L',
  scope: 'operator',
  initial: 's0',
  transitions: [],
  states: Array.from({ length: n }, (_, i) => ({ key: `s${i}`, name: `S${i}`, onEnter: [], tags: [] })),
});

describe('ladderTone', () => {
  it('first ok, worst third crit, middle warn', () => {
    expect(['s0', 's1', 's2'].map((s) => ladderTone(ladder(3), s))).toEqual(['ok', 'warn', 'crit']);
    expect(['s0', 's1', 's2', 's3'].map((s) => ladderTone(ladder(4), s))).toEqual(['ok', 'warn', 'crit', 'crit']);
    expect(ladderTone(ladder(2), 's1')).toBe('crit');
    expect(ladderTone(ladder(3), 'nope')).toBe('neutral');
  });
  it('badge carries state name and initial flag', () => {
    expect(ladderBadge(ladder(3), 's0')).toMatchObject({ label: 'S0', initial: true, tone: 'ok' });
    expect(ladderBadge(ladder(3), 'zz')).toMatchObject({ label: 'zz', initial: false });
  });
});

describe('GEMINI badges', () => {
  it('fit operators show one ok badge; wounded show only off-initial ladders', () => {
    const { engine, campaign } = startGemini();
    expect(operatorBadges(campaign, engine.state.operators['acheron']!).map((b) => [b.label, b.tone])).toEqual([['Fit for duty', 'ok']]);
    engine.dispatch({ type: 'resolveAar', aar: { mission: 'first-light', outcome: 'success', operators: { acheron: { fields: { casualty: 'serious' } } } } });
    const s = engine.state;
    expect(operatorBadges(campaign, s.operators['acheron']!).map((b) => [b.ladderName, b.label, b.tone])).toEqual([['Medical Status', 'Serious Wound', 'crit']]);
    const ready = teamBadges(campaign, s.teams['revenants']!);
    expect(ready.map((b) => b.label)).toEqual(['RED']);
    expect(worstTone(ready)).toBe('crit');
    expect(worstTone([])).toBe('neutral');
  });
});
