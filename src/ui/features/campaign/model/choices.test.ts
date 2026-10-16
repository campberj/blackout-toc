import { describe, expect, it } from 'vitest';
import { choiceView, choiceViews } from './choices';
import { campaignTables } from './tables';
import { startGemini } from './__fixtures__/gemini';

describe('pending choices', () => {
  it('one option per team (full teams disabled) plus decline', () => {
    const { engine, campaign } = startGemini();
    const s = structuredClone(engine.state);
    s.pending.push({ key: 'c1', kind: 'placeOperator', prompt: 'Place the replacement', operator: { name: 'Kade', tags: [] }, team: 'pale-horse', seq: 1 });
    s.teams['revenants']!.operators.push('acheron'); // 3 active entries → full at max 3
    const v = choiceView(campaign, s, s.pending[0]!);
    expect(v).toMatchObject({ key: 'c1', operatorName: 'Kade' });
    expect(v.options.map((o) => [o.value, o.disabled, o.suggested])).toEqual([
      ['team:revenants', true, false],
      ['team:pale-horse', false, true],
      ['team:ironclad', false, false],
      ['discard', false, false],
    ]);
    expect(v.options[0]!.reason).toMatch(/full strength/);
    expect(choiceViews(campaign, engine.state)).toEqual([]);
  });
});

describe('campaignTables', () => {
  it("campaign pack's tables minus the name table", () => {
    const { campaign, registry } = startGemini();
    const t = campaignTables(campaign, registry);
    expect(t.map((x) => x.id)).not.toContain('blackfall-gemini:utg-names');
    expect(t.map((x) => x.name)).toContain('Sector 7 Events');
    expect(t).toHaveLength(7);
  });
});
