import { describe, expect, it } from 'vitest';
import { loadPacks } from '$lib/packs/loader';
import { UnitCard, type Id } from '$lib/packs/schema';
import { fx } from './__fixtures__';
import { cardKeys, isCustom, keywordGlossary, toCardViewModel, toForceCardViewModel } from './card-mapper';

const loaded = loadPacks([fx().demo, fx().other]);
if (!loaded.ok) throw new Error('fixtures');
const lookup = loaded.value.registry;
const unit = (id: string) => lookup.get('unit', id as Id)!;

describe('toCardViewModel', () => {
  it('maps a full unit with resolved names, specialist items after unit items', () => {
    const vm = toCardViewModel(unit('demo:lantern-wardens'), { lookup, rulesetId: 'demo:house' });
    expect(vm).toEqual({
      id: 'demo:lantern-wardens',
      name: 'Lantern Wardens',
      faction: 'Glasswing Cooperative',
      type: 'Infantry',
      stats: [
        { label: 'Skill', value: '6+' },
        { label: 'Move', value: '6"' },
      ],
      armor: '1/6',
      grunts: 3,
      specialists: [{ name: 'Lamplighter', text: 'Skill 5+' }],
      combatLoads: 1,
      rules: [
        { name: 'Steady', text: 'Invented rule.', usesMax: 2 },
        { name: 'Lamplighter: Glow', text: 'Invented.', usesMax: 1 },
      ],
      weapons: [
        { name: 'Lamp Rifle', profile: '4-16"/2  Ricochet (1)' },
        { name: 'Hook', profile: '1"/1  1 use' },
      ],
      damageTracks: [],
      keywords: ['Tethered'],
    });
  });

  it('handler tracks, no keywords, custom flag, unloaded faction/keyword fallbacks', () => {
    const vm = toCardViewModel(unit('demo:warden-captain'), { lookup });
    expect(vm.damageTracks).toEqual([{ name: 'Wounds', size: 2 }]);
    expect(vm.keywords).toBeUndefined();
    expect(vm.custom).toBeUndefined();
    const custom = UnitCard.parse({
      ...unit('demo:warden-captain'),
      id: 'x',
      faction: 'ghost:clan',
      source: { custom: true },
      weapons: [
        { key: 'ability', name: 'Leap', text: 'Gains Jump (4).' },
        { key: 'zap', name: 'Zap', maxRange: 6, keywords: [{ key: 'ghost:shock', x: 2 }], usesMax: 3 },
      ],
      specialists: [
        { key: 'a', name: 'A', move: 8, armor: { dice: 2, target: 5 }, keywords: [{ key: 'demo:tethered' }], weapons: [{ key: 'w', name: 'W', damage: 1 }] },
        { key: 'b', name: 'B' },
      ],
    });
    const cvm = toCardViewModel(custom, { lookup });
    expect(cvm.faction).toBe('Clan');
    expect(cvm.custom).toBe(true);
    expect(cvm.weapons.map((w) => w.profile)).toEqual(['Gains Jump (4).', '6"  Shock (2)  3 uses', '—/1']);
    expect(cvm.weapons[2]!.name).toBe('A: W');
    expect(cvm.specialists).toEqual([{ name: 'A', text: 'Move 8" · Armor 2/5 · Tethered' }, { name: 'B' }]);
    expect(isCustom({ ...custom, source: {}, id: 'user:x' })).toBe(true);
  });

  it('cardKeys are index-aligned with the view model', () => {
    const u = unit('demo:lantern-wardens');
    const vm = toCardViewModel(u, { lookup });
    const keys = cardKeys(u);
    expect(keys).toEqual({ weapons: ['lamp-rifle', 'hook'], rules: ['steady', 'lamplighter/glow'], damageTracks: [] });
    expect(keys.rules.length).toBe(vm.rules.length);
    expect(cardKeys(unit('demo:warden-captain')).damageTracks).toEqual(['wounds']);
  });

  it('keywordGlossary uses ruleset text, dedupes, falls back', () => {
    const u = unit('demo:lantern-wardens');
    expect(keywordGlossary(u, { lookup, rulesetId: 'demo:house' })).toEqual([
      { key: 'demo:tethered', name: 'Tethered', text: 'Invented: must stay near its leader.' },
      { key: 'demo:ricochet', name: 'Ricochet', text: 'Invented house text.' },
    ]);
    expect(keywordGlossary(u, { lookup })[1]!.text).toBe('Invented: bounces to X extra targets.');
    const odd = UnitCard.parse({ ...u, id: 'o', keywords: [{ key: 'x:y' }, { key: 'x:y' }], weapons: [], specialists: [{ key: 's', name: 'S', weapons: [{ key: 'w', name: 'W', keywords: [{ key: 'demo:ricochet' }] }] }] });
    expect(keywordGlossary(odd, { lookup })).toEqual([
      { key: 'x:y', name: 'Y', text: '' },
      { key: 'demo:ricochet', name: 'Ricochet', text: 'Invented: bounces to X extra targets.' },
    ]);
  });
});

describe('toForceCardViewModel', () => {
  it('maps drills and armory in pack order', () => {
    const f = lookup.get('force', 'demo:lantern-detachment')!;
    expect(toForceCardViewModel(f, { lookup })).toEqual({
      id: 'demo:lantern-detachment',
      name: 'Lantern Detachment',
      faction: 'Glasswing Cooperative',
      forceRule: 'Invented force rule text.',
      battleDrills: [{ name: 'Hush', text: 'Invented drill.', cost: '1 CP' }],
      armory: [
        { kind: 'weapon', name: 'Flare Gun', profile: '18"/1  Ricochet (1)' },
        { kind: 'ability', name: 'Patch Kit', profile: '', text: 'Invented ability.' },
      ],
      dusterArmory: [],
    });
  });

  it('carries uses, cost and weapon text', () => {
    const f = {
      ...lookup.get('force', 'demo:lantern-detachment')!,
      battleDrills: [{ key: 'd', name: 'D', text: 't', usesMax: 2 }],
      dusterArmory: [
        { kind: 'weapon' as const, weapon: { key: 'w', name: 'W', keywords: [], text: 'Special.', usesMax: 1 } },
        { kind: 'ability' as const, ability: { key: 'a', name: 'A', text: 'x', cpCost: 2, usesMax: 1 } },
      ],
    };
    const vm = toForceCardViewModel(f, { lookup });
    expect(vm.battleDrills).toEqual([{ name: 'D', text: 't', usesMax: 2 }]);
    expect(vm.dusterArmory).toEqual([
      { kind: 'weapon', name: 'W', profile: '', text: 'Special.', usesMax: 1 },
      { kind: 'ability', name: 'A', profile: '', text: 'x', cost: '2 CP', usesMax: 1 },
    ]);
  });
});
