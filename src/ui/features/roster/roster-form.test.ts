import { describe, expect, it } from 'vitest';
import { createAppContext } from '../../../app';
import { bundle, fx, memStorage } from '../../../app/__fixtures__';
import type { RosterMode } from '$lib/packs/schema';
import type { Roster } from '../../../app';
import { blankRoster, byFaction, copyName, DRAFT_ID, handlerRule, modeOf, modeSummary, toNewInput, unitCount, unitOptions, withOptional } from './roster-form';

const reg = async () => (await createAppContext(memStorage(), bundle(fx().other, fx().demo))).snapshot().registry;

const mode = (over: Partial<RosterMode> = {}): RosterMode => ({
  mode: 'matched',
  name: 'Matched',
  groups: { min: 1, max: 1 },
  forceCardsPerGroup: { min: 1, max: 1 },
  unitsPerGroup: { min: 3, max: 3 },
  distinctUnitsPerGroup: true,
  handlersPerGroup: { min: 1, max: 1 },
  dusters: { max: 1, replacesUnit: true },
  limits: [],
  ...over,
});

describe('roster form', () => {
  it('builds a blank roster from the first mode', async () => {
    const r = blankRoster(await reg(), 'demo:house');
    expect(r).toEqual({ id: DRAFT_ID, name: 'New team', rulesetId: 'demo:house', mode: 'matched', groups: [{ unitIds: [] }], notes: '' });
    expect(blankRoster(await reg(), 'other-demo:alt').mode).toBe('core');
  });

  it('describes modes and handler rules', () => {
    expect(modeSummary(mode())).toBe('1 group, 1 force card per group, 3 units (all different) per group, handler required, up to 1 duster');
    expect(modeSummary(mode({ groups: { min: 1 }, handlersPerGroup: { max: 0 }, dusters: { max: 0, replacesUnit: true } }))).toBe(
      '1+ groups, 1 force card per group, 3 units (all different) per group, no handlers',
    );
    expect(handlerRule(mode({ handlersPerGroup: { max: 1 } }))).toBe('optional');
    expect(handlerRule(undefined)).toBe('optional');
  });

  it('splits unit options by role and groups by faction', async () => {
    const r = await reg();
    const o = unitOptions(r, modeOf(r, { rulesetId: 'demo:house', mode: 'matched' }));
    expect(o.handlers.map((u) => u.id)).toEqual(['demo:warden-captain']);
    expect(o.units.map((u) => u.id)).toEqual(['demo:choir-hulk', 'demo:lantern-wardens', 'other-demo:scout-bike']);
    expect(o.forces).toHaveLength(1);
    expect(unitOptions(r, mode({ allowedUnitTypes: ['infantry'] })).units).toHaveLength(1);
    expect(byFaction(r, o.units, 'other-demo:dune-runners').map((g) => g.label)).toEqual(['Dune Runners', 'Glasswing Cooperative', 'Rust Choir']);
  });

  it('names copies uniquely', () => {
    expect(copyName('Alpha', [])).toBe('Alpha (copy)');
    expect(copyName('Alpha (copy)', ['Alpha (copy)'])).toBe('Alpha (copy 2)');
  });

  it('clears optional ids and strips the draft id', () => {
    const r: Roster = { ...blankRoster({ get: () => undefined, list: () => [], keywordText: () => undefined } as never, 'a:b'), dusterId: 'a:d' };
    expect('dusterId' in withOptional(r, 'dusterId', '')).toBe(false);
    expect(withOptional(r, 'dusterId', 'a:e').dusterId).toBe('a:e');
    expect('id' in toNewInput(r)).toBe(false);
    expect(unitCount({ ...r, groups: [{ unitIds: ['a:x' as const], handlerId: 'a:h' as const }] })).toBe(3);
  });
});
