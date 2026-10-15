import { describe, expect, it } from 'vitest';
import { Armor, ForceCard, Id, Keyword, KeywordRef, LocalOrQualifiedId, UnitCard, Weapon } from './index';

const unit = {
  id: 'test-unit',
  name: 'Test Unit',
  faction: 'demo:glasswing',
  type: 'infantry',
  skill: 6,
  move: 6,
  armor: { dice: 1, target: 6 },
  grunts: 2,
  combatLoads: 1,
  weapons: [{ key: 'pistol', name: 'Pistol', maxRange: 12, damage: 1 }],
};

describe('ids', () => {
  it.each(['demo:unit', 'a1:b-2', 'pack-x:local-y'])('accepts qualified %j', (s) => expect(Id.safeParse(s).success).toBe(true));
  it.each(['demo', 'Demo:unit', 'demo:Unit', 'demo:', ':unit', 'demo:a:b', 'demo:a_b', 'demo:-a', 'de mo:a', `a:${'x'.repeat(65)}`])(
    'rejects %j',
    (s) => expect(Id.safeParse(s).success).toBe(false),
  );
  it('pack-source refs accept bare or qualified', () => {
    expect(LocalOrQualifiedId.safeParse('unit').success).toBe(true);
    expect(LocalOrQualifiedId.safeParse('demo:unit').success).toBe(true);
    expect(LocalOrQualifiedId.safeParse('Unit').success).toBe(false);
  });
});

describe('armor + keyword refs', () => {
  it('bounds armor', () => {
    expect(Armor.safeParse({ dice: 3, target: 10 }).success).toBe(true);
    expect(Armor.safeParse({ dice: 4, target: 6 }).success).toBe(false);
    expect(Armor.safeParse({ dice: 0, target: 6 }).success).toBe(false);
    expect(Armor.safeParse({ dice: 1, target: 11 }).success).toBe(false);
    expect(Armor.safeParse({ dice: 1.5, target: 6 }).success).toBe(false);
  });
  it('keyword refs', () => {
    expect(KeywordRef.parse({ key: 'core:blast', x: 1 })).toEqual({ key: 'core:blast', x: 1 });
    expect(KeywordRef.safeParse({ key: 'core:blast', x: -1 }).success).toBe(false);
  });
});

describe('cards', () => {
  it('parses a minimal unit and fills defaults', () => {
    const u = UnitCard.parse(unit);
    expect(u.specialists).toEqual([]);
    expect(u.weapons[0]!.keywords).toEqual([]);
    expect(u.damageTracks).toBeUndefined();
  });
  it('rejects armor dice 4 on a unit (with JSON path)', () => {
    const r = UnitCard.safeParse({ ...unit, armor: { dice: 4, target: 6 } });
    expect(r.error?.issues[0]?.path).toEqual(['armor', 'dice']);
  });
  it('rejects unknown type, duplicate weapon keys, too many weapons', () => {
    expect(UnitCard.safeParse({ ...unit, type: 'mech' }).success).toBe(false);
    expect(UnitCard.safeParse({ ...unit, weapons: [unit.weapons[0], unit.weapons[0]] }).success).toBe(false);
    const many = Array.from({ length: 9 }, (_, i) => ({ key: `w${i}`, name: `W${i}` }));
    expect(UnitCard.safeParse({ ...unit, weapons: many }).success).toBe(false);
  });
  it('specialist stat overrides are optional', () => {
    const u = UnitCard.parse({ ...unit, specialists: [{ key: 's', name: 'S', armor: { dice: 1, target: 5 } }] });
    expect(u.specialists[0]!.skill).toBeUndefined();
    expect(u.specialists[0]!.armor).toEqual({ dice: 1, target: 5 });
  });
  it('weapon range ordering', () => {
    expect(Weapon.safeParse({ key: 'w', name: 'W', minRange: 10, maxRange: 4 }).success).toBe(false);
    expect(Weapon.safeParse({ key: 'w', name: 'W', text: 'gains Something (4)' }).success).toBe(true);
  });
  it('keyword requires appliesTo and allows per-ruleset text', () => {
    expect(Keyword.safeParse({ id: 'k', name: 'K', gist: 'g' }).success).toBe(false);
    expect(Keyword.safeParse({ id: 'k', name: 'K', gist: 'g', appliesTo: 'model', byRuleset: { 'x:y': 't' } }).success).toBe(true);
    expect(Keyword.safeParse({ id: 'k', name: 'K', gist: 'g', appliesTo: 'model', byRuleset: { 'X Y': 't' } }).success).toBe(false);
  });
  it('force card armory is a tagged union', () => {
    const base = { id: 'f', name: 'F', faction: 'g', forceRule: 'r' };
    expect(ForceCard.safeParse({ ...base, armory: [{ kind: 'weapon', weapon: { key: 'a', name: 'A' } }] }).success).toBe(true);
    expect(ForceCard.safeParse({ ...base, armory: [{ kind: 'gadget' }] }).success).toBe(false);
  });
});
