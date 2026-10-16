import { describe, expect, it } from 'vitest';
import { must, startedEngine, lookup } from '$lib/domain/game/__fixtures__/game';
import { templateFromContact } from '$lib/domain/game';
import { damageSummary, strength, trackerCommand, unitView } from './board';

describe('unitView', () => {
  const e = startedEngine();
  must(e, { type: 'setRuleBoxes', unit: 'p2', rule: 'lamplighter/glow', ticked: 1 });
  must(e, { type: 'setDamage', unit: 'p1', model: 'g1', track: 'wounds', marked: 1 });
  must(e, { type: 'addUnit', side: 'opfor', unit: templateFromContact({ name: 'Scavs', models: 2, track: { name: 'Hits', size: 2 } }) });
  const ctx = { lookup: lookup(), rulesetId: undefined };
  const [captain, wardens] = e.state.units;

  it('aligns tracker with the card mapper and maps taps back to commands', () => {
    const v = unitView(wardens!, ctx);
    expect(v.card.rules.map((r) => r.name)).toEqual(['Steady', 'Lamplighter: Glow']);
    expect(v.ruleKeys).toEqual(['steady', 'lamplighter/glow']);
    expect(v.tracker).toEqual({ combatLoadsUsed: 0, ruleUses: [0, 1], damage: [] });
    expect(trackerCommand(wardens!, v, { kind: 'rule', index: 1, value: 0 })).toEqual({ type: 'setRuleBoxes', unit: 'p2', rule: 'lamplighter/glow', ticked: 0 });
    expect(trackerCommand(wardens!, v, { kind: 'loads', index: 0, value: 1 })).toEqual({ type: 'setLoads', unit: 'p2', used: 1 });
    expect(trackerCommand(wardens!, v, { kind: 'damage', index: 0, value: 1 })).toBeNull();
  });

  it('single-model units carry damage on the card', () => {
    const v = unitView(captain!, ctx);
    expect(v.card.damageTracks).toEqual([{ name: 'Wounds', size: 2 }]);
    expect(v.tracker.damage).toEqual([1]);
    expect(trackerCommand(captain!, v, { kind: 'damage', index: 0, value: 2 })).toEqual({ type: 'setDamage', unit: 'p1', model: 'g1', track: 'wounds', marked: 2 });
  });

  it('custom contacts get a synthetic card; multi-model damage moves to chips', () => {
    const scavs = e.state.units.at(-1)!;
    const v = unitView(scavs, null);
    expect(v).toMatchObject({ perModelDamage: true, card: { type: 'Contact', name: 'Scavs', damageTracks: [] } });
    expect(unitView({ ...wardens!, unitId: 'demo:gone' }, ctx).card.type).toBe('Unit (card not loaded)');
    expect(trackerCommand(scavs, v, { kind: 'rule', index: 0, value: 1 })).toBeNull();
    expect(damageSummary(scavs, scavs.models[0]!)).toBe('0/2');
    expect(strength({ ...scavs, models: [{ ...scavs.models[0]!, status: 'destroyed' }, scavs.models[1]!] })).toEqual({ up: 1, total: 2 });
  });
});
