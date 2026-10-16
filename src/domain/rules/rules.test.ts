import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { CalibrationProfile, RulesetProfile, UnitCard } from '$lib/packs/schema';
import { loadPacks } from '$lib/packs/loader';
import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import other from '$lib/packs/loader/__fixtures__/other-demo-pack.json';
import {
  applicableCalibrations,
  describeCount,
  dotted,
  fieldValues,
  hasErrors,
  issue,
  matchesSelector,
  outsideCount,
  validateUnit,
  violates,
} from '.';

type UnitCardInput = z.input<typeof UnitCard>;

// Invented units only.
const unit = (over: Partial<UnitCardInput> = {}) =>
  UnitCard.parse({
    id: 'u',
    name: 'Test Squad',
    faction: 'demo:glasswing',
    type: 'infantry',
    skill: 6,
    move: 6,
    armor: { dice: 1, target: 6 },
    grunts: 2,
    combatLoads: 1,
    weapons: [
      { key: 'gun', name: 'Gun', maxRange: 18, damage: 1, keywords: [{ key: 'demo:ricochet', x: 1 }] },
      { key: 'knife', name: 'Knife', damage: 1 },
    ],
    ...over,
  });

const ruleset = RulesetProfile.parse({
  id: 'r',
  name: 'R',
  startingCp: 3,
  roundLimit: 5,
  dusterRules: 'core',
  coverModel: 'binary',
  unitLimits: [
    { key: 'skill', field: 'skill', min: 4, max: 8, message: 'Skill 4–8' },
    { key: 'inf-dice', field: 'armor.dice', when: { types: ['infantry'] }, in: [1], message: 'Infantry: 1 die' },
    { key: 'range', field: 'weapon.maxRange', max: 24, message: 'Range ≤ 24' },
    { key: 'weapons', field: 'weapons', min: 1, max: 2, message: '1–2 weapons' },
  ],
});

describe('selector', () => {
  const u = unit({ tags: ['elite'], keywords: [{ key: 'demo:tethered' }] });
  it.each([
    [undefined, true],
    [{}, true],
    [{ types: [] }, true],
    [{ types: ['infantry'] }, true],
    [{ types: ['handler'] }, false],
    [{ exceptTypes: ['infantry'] }, false],
    [{ tags: ['elite', 'x'] }, true],
    [{ tags: ['x'] }, false],
    [{ keywords: ['demo:tethered'] }, true],
    [{ keywords: ['demo:other'] }, false],
  ] as const)('%j → %s', (sel, want) => {
    expect(matchesSelector(u, sel as never)).toBe(want);
  });
  it('counts', () => {
    expect(outsideCount(2, { min: 3 })).toBe(true);
    expect(outsideCount(4, { max: 3 })).toBe(true);
    expect(outsideCount(3, { min: 3, max: 3 })).toBe(false);
    expect([{ min: 3, max: 3 }, { min: 1, max: 3 }, { min: 1 }, { max: 2 }, {}].map(describeCount)).toEqual([
      'exactly 3',
      '1–3',
      'at least 1',
      'at most 2',
      'any number',
    ]);
  });
});

describe('fieldValues / violates', () => {
  const u = unit({ specialists: [{ key: 's', name: 'S' }] });
  it('addresses scalar, nested, list and per-weapon fields', () => {
    expect(fieldValues(u, 'skill')).toEqual([{ path: 'skill', value: 6 }]);
    expect(fieldValues(u, 'armor.target')).toEqual([{ path: 'armor.target', value: 6 }]);
    expect(fieldValues(u, 'armor.dice')).toEqual([{ path: 'armor.dice', value: 1 }]);
    expect(fieldValues(u, 'specialists')).toEqual([{ path: 'specialists', value: 1 }]);
    expect(fieldValues(u, 'weapon.maxRange')).toEqual([{ path: 'weapons.0.maxRange', value: 18 }]);
    expect(fieldValues(u, 'weapon.damage').map((v) => v.path)).toEqual(['weapons.0.damage', 'weapons.1.damage']);
  });
  it.each([
    [{ min: 2 }, 1, true],
    [{ max: 2 }, 3, true],
    [{ in: [1, 2] }, 3, true],
    [{ notIn: [2] }, 2, true],
    [{ min: 1, max: 3, in: [2], notIn: [3] }, 2, false],
  ])('%j vs %d', (c, v, want) => {
    expect(violates(c, v)).toBe(want);
  });
});

describe('validateUnit', () => {
  const loaded = loadPacks([demo, other]);
  if (!loaded.ok) throw new Error('fixtures');
  const lookup = loaded.value.registry;

  it('clean unit has no issues', () => {
    expect(validateUnit(unit(), { lookup, ruleset })).toEqual([]);
  });

  it('ruleset limits are field-level errors', () => {
    const u = unit({ skill: 9, armor: { dice: 2, target: 6 }, weapons: [{ key: 'w', name: 'W', maxRange: 30 }] });
    const issues = validateUnit(u, { ruleset });
    expect(issues.map((i) => [i.severity, i.path, i.key])).toEqual([
      ['error', 'skill', 'skill'],
      ['error', 'armor.dice', 'inf-dice'],
      ['error', 'weapons.0.maxRange', 'range'],
    ]);
    expect(hasErrors(issues)).toBe(true);
  });

  it('selector scopes limits by type', () => {
    expect(validateUnit(unit({ type: 'handler', armor: { dice: 2, target: 6 } }), { ruleset })).toEqual([]);
  });

  it('unresolved faction and keyword refs (unit, weapon, specialist)', () => {
    const u = unit({
      faction: 'demo:nobody',
      keywords: [{ key: 'demo:nope' }],
      specialists: [{ key: 's', name: 'S', keywords: [{ key: 'x:y' }], weapons: [{ key: 'w', name: 'W', keywords: [{ key: 'x:z' }] }] }],
    });
    expect(validateUnit(u, { lookup }).map((i) => i.path)).toEqual([
      'faction',
      'keywords.0.key',
      'specialists.0.keywords.0.key',
      'specialists.0.weapons.0.keywords.0.key',
    ]);
  });

  it('calibration checks are warnings', () => {
    const cal = lookup.get('calibration', 'demo:demo-calibration')!;
    const issues = validateUnit(unit({ skill: 5 }), { calibrations: [cal] });
    expect(issues).toEqual([issue('warning', 'skill', 'calibration', 'Unusually skilled for regulars', 'skill-regular')]);
    expect(hasErrors(issues)).toBe(false);
  });

  it('percentile outliers against same-type population', () => {
    const cal = CalibrationProfile.parse({ id: 'c', name: 'C', outliers: { fields: ['move', 'weapon.damage'], percentile: 10 } });
    const pop = [4, 5, 6, 6, 6, 7].map((move, i) => unit({ id: `p${i}`, move }));
    const fast = unit({ move: 12, weapons: [{ key: 'w', name: 'W', damage: 5 }] });
    const issues = validateUnit(fast, { calibrations: [cal], population: pop });
    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['outlier', 'move'],
      ['outlier', 'weapons.0.damage'],
    ]);
    expect(issues[0]!.message).toMatch(/4–7/);
    // Too few peers of the same type → no outlier noise.
    expect(validateUnit(unit({ type: 'handler', move: 20 }), { calibrations: [cal], population: pop })).toEqual([]);
    // Field with too few samples is skipped.
    const sparse = CalibrationProfile.parse({ id: 'c', name: 'C', outliers: { fields: ['weapon.maxRange'], percentile: 10 } });
    const noRange = pop.map((u) => ({ ...u, weapons: [] }));
    expect(validateUnit(fast, { calibrations: [sparse], population: noRange })).toEqual([]);
  });

  it('applicableCalibrations filters by ruleset', () => {
    const any = CalibrationProfile.parse({ id: 'a', name: 'A' });
    const house = CalibrationProfile.parse({ id: 'h', name: 'H', rulesets: ['demo:house'] });
    expect(applicableCalibrations([any, house], 'demo:house')).toEqual([any, house]);
    expect(applicableCalibrations([any, house], 'other-demo:alt')).toEqual([any]);
    expect(applicableCalibrations([any, house], undefined)).toEqual([any]);
  });

  it('dotted paths', () => {
    expect(dotted(['weapons', 0, 'maxRange'])).toBe('weapons.0.maxRange');
  });
});
