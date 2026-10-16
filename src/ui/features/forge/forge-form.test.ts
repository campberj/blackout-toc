import { describe, expect, it } from 'vitest';
import { createAppContext, hasErrors, toCardViewModel } from '../../../app';
import { bundle, draft, fx, memStorage } from '../../../app/__fixtures__';
import { blankForm, blankRule, blankWeapon, formToDraft, localId, previewUnit, unitToForm } from './forge-form';

const ctx = async () => {
  const c = await createAppContext(memStorage(), bundle(fx().other, fx().demo));
  await c.settings.setActiveRuleset('demo:house');
  return c;
};

describe('forge form', () => {
  it('blank form + name + faction validates cleanly', async () => {
    const c = await ctx();
    const f = { ...blankForm('demo:glasswing'), name: 'Night Wardens' };
    f.weapons[0] = { ...blankWeapon(), name: 'Lamp Gun', maxRange: 12, damage: 1 };
    const d = formToDraft(f);
    expect(d.weapons?.[0]).toEqual({ key: 'lamp-gun', name: 'Lamp Gun', maxRange: 12, damage: 1, keywords: [] });
    expect(hasErrors(c.customUnits.validate(d))).toBe(false);
  });

  it('omits empty required numbers so the schema flags the field', async () => {
    const c = await ctx();
    const d = formToDraft({ ...blankForm('demo:glasswing'), name: 'X', skill: null, armorTarget: undefined });
    const paths = c.customUnits.validate(d).map((i) => i.path);
    expect(paths).toContain('skill');
    expect(paths).toContain('armor');
  });

  it('derives unique keys for new items and keeps existing ones', () => {
    const f = { ...blankForm('a:b'), name: 'U', rules: [{ ...blankRule(), name: 'Steady' }, { ...blankRule(), name: 'Steady' }, { ...blankRule(), key: 'old', name: 'Renamed' }] };
    expect(formToDraft(f).rules?.map((r) => r.key)).toEqual(['steady', 'steady-2', 'old']);
    expect(formToDraft({ ...f, rules: [blankRule()] }).rules?.[0]?.key).toBe('rule-1');
  });

  it('round-trips a saved unit', async () => {
    const c = await ctx();
    const saved = await c.customUnits.create(
      draft({
        rules: [{ key: 'steady', name: 'Steady', usesMax: 2, text: 'Invented.' }],
        specialists: [{ key: 'spotter', name: 'Spotter', skill: 5, armor: { dice: 1, target: 5 } }],
        damageTracks: [{ key: 'wounds', name: 'Wounds', size: 2 }],
      }),
    );
    if (!saved.ok) throw new Error(JSON.stringify(saved.error));
    const back = formToDraft(unitToForm(saved.value.unit));
    expect(back).toMatchObject({ name: 'Night Wardens', skill: 6, armor: { dice: 1, target: 6 }, rules: [{ key: 'steady', usesMax: 2 }] });
    expect(back.specialists?.[0]).toMatchObject({ key: 'spotter', skill: 5, armor: { dice: 1, target: 5 } });
    expect(back.damageTracks).toEqual([{ key: 'wounds', name: 'Wounds', size: 2 }]);
    expect(localId(saved.value.unit.id)).toBe('night-wardens');
    expect((await c.customUnits.update(saved.value.unit.id, back)).ok).toBe(true);
  });

  it('previews incomplete forms', async () => {
    const c = await ctx();
    const vm = toCardViewModel(previewUnit({ ...blankForm(), skill: null, weapons: [blankWeapon()] }), c.cardContext());
    expect(vm).toMatchObject({ name: 'Unnamed unit', custom: true, stats: [{ value: '0+' }, { value: '6"' }] });
    expect(vm.weapons[0]?.name).toBe('Unnamed weapon');
  });
});
