import { describe, expect, it } from 'vitest';
import { describeRow, effectOps, newRow, normalizeRow, rowProblems, rowToEffect, targetOptions, valueOptions, type EffectRow } from './effects';
import { startGemini } from './__fixtures__/gemini';
import { Effect } from '$lib/packs/schema';

describe('effect rows', () => {
  const { engine, campaign } = startGemini();
  const s = engine.state;

  it('ops per context', () => {
    expect(effectOps(campaign, 'reward').map((o) => o.value)).toEqual(['adjustTrack', 'adjustPool', 'grantAsset', 'addXp']);
    expect(effectOps(campaign, 'manual')).toHaveLength(9);
    expect(effectOps({ ...campaign, pools: [] }, 'reward').map((o) => o.value)).not.toContain('adjustPool');
  });

  it('targets follow ladder scope', () => {
    expect(targetOptions(campaign, s, 'reward')).toEqual([{ value: 'participants', label: 'Mission participants' }]);
    const ready = normalizeRow(campaign, s, { ...newRow(campaign, s, 'setLadder', 'manual'), ref: 'readiness' }, 'manual');
    expect(targetOptions(campaign, s, 'manual', ready).map((t) => t.value)).toEqual(['team:revenants', 'team:pale-horse', 'team:ironclad']);
    expect(valueOptions(campaign, ready).map((v) => v.label)).toEqual(['GREEN', 'AMBER', 'RED']);
    const xp = newRow(campaign, s, 'addXp', 'manual');
    expect(xp.target).toBe('operator:acheron');
    expect(targetOptions(campaign, s, 'manual', xp).at(-1)).toEqual({ value: 'roster', label: 'Whole roster' });
  });

  it('every row op produces a schema-valid effect and a readable summary', () => {
    for (const { value } of effectOps(campaign, 'manual')) {
      const row = newRow(campaign, s, value as EffectRow['op'], 'manual');
      if (row.op === 'setFlag') row.ref = 'op-secured';
      expect(Effect.safeParse(rowToEffect(row)).success, value).toBe(true);
      expect(describeRow(campaign, s, row, 'manual').length).toBeGreaterThan(3);
      expect(rowProblems(row)).toBeNull();
    }
    expect(rowToEffect({ op: 'setFlag', ref: 'a', target: '', amount: 0, value: '3' })).toEqual({ op: 'setFlag', flag: 'a', value: 3 });
    expect(rowToEffect({ op: 'setFlag', ref: 'a', target: '', amount: 0, value: 'false' })).toEqual({ op: 'setFlag', flag: 'a', value: false });
    expect(rowToEffect({ op: 'grantAsset', ref: 'medevac', target: '', amount: 0, value: '' })).toEqual({ op: 'grantAsset', asset: 'medevac', count: 1 });
  });

  it('problems: bad flag key, missing target', () => {
    expect(rowProblems({ op: 'setFlag', ref: 'Bad Key', target: '', amount: 0, value: 'true' })).toMatch(/Flag key/);
    expect(rowProblems({ op: 'addXp', ref: '', target: '', amount: 1, value: '' })).toMatch(/who/);
    expect(rowProblems({ op: 'adjustTrack', ref: 'intel', target: '', amount: NaN, value: '' })).toMatch(/number/);
  });
});
