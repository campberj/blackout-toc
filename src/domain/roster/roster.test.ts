import { describe, expect, it } from 'vitest';
import { loadPacks } from '$lib/packs/loader';
import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import other from '$lib/packs/loader/__fixtures__/other-demo-pack.json';
import { Roster, validateRoster, type RosterInput } from '.';

// demo:house matched = 1 group, 1 force, exactly 3 distinct units, 1 handler, ≤1 duster, ≤1 `outsider`.
const base = (): RosterInput => ({
  id: 'r1',
  name: 'Lantern Team',
  rulesetId: 'demo:house',
  mode: 'matched',
  groups: [
    {
      forceCardId: 'demo:lantern-detachment',
      handlerId: 'demo:warden-captain',
      unitIds: ['demo:lantern-wardens', 'demo:choir-hulk', 'other-demo:scout-bike'],
    },
  ],
});

function withPacks(...extra: object[]) {
  const d = structuredClone(demo) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = loadPacks([d, other, ...extra]);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value.registry;
}
const lookup = withPacks();
const check = (input: RosterInput, l = lookup) => validateRoster(Roster.parse(input), l);
const paths = (input: RosterInput, l = lookup) => check(input, l).map((i) => `${i.path}:${i.code}`);

describe('Roster schema', () => {
  it('defaults groups/notes and rejects bare ids', () => {
    const r = Roster.parse({ id: 'x', name: 'X', rulesetId: 'demo:house', mode: 'core' });
    expect(r).toMatchObject({ groups: [], notes: '' });
    expect(Roster.safeParse({ ...base(), groups: [{ handlerId: 'warden-captain' }] }).success).toBe(false);
    // Roster-level handler is gone (v2); old records go through the collection migration.
    expect(Roster.safeParse({ ...base(), handlerId: 'demo:warden-captain' }).success).toBe(false);
  });
});

describe('validateRoster', () => {
  it('valid matched roster', () => {
    expect(check(base())).toEqual([]);
  });

  it('unknown ruleset / mode short-circuit', () => {
    expect(paths({ ...base(), rulesetId: 'x:y' })).toEqual(['rulesetId:unresolved']);
    expect(paths({ ...base(), mode: 'skirmish' })).toEqual(['mode:mode_unavailable']);
  });

  it('missing force, handler, too few units', () => {
    const r: RosterInput = { ...base(), groups: [{ unitIds: ['demo:lantern-wardens'] }] };
    expect(paths(r)).toEqual(['groups.0.forceCardId:count', 'groups.0.unitIds:count', 'groups.0.handlerId:handler_count']);
    expect(check(r).map((i) => i.message).slice(1)).toEqual([
      'Matched: exactly 3 unit(s) per group required (has 1)',
      'Matched: each group needs a handler',
    ]);
  });

  it('group count, unresolved refs, duplicates, wrong handler type', () => {
    expect(paths({ ...base(), groups: [] })).toEqual(['groups:count']);
    const r = base();
    r.groups = [{ forceCardId: 'demo:nope', handlerId: 'demo:choir-hulk', unitIds: ['demo:lantern-wardens', 'demo:lantern-wardens', 'demo:ghost'] }];
    expect(paths(r)).toEqual([
      'groups.0.forceCardId:unresolved',
      'groups.0.unitIds.1:duplicate',
      'groups.0.unitIds.2:unresolved',
      'groups.0.handlerId:wrong_type',
      'groups.0.handlerId:handler_count', // the hostile in the handler slot is not a handler
    ]);
  });

  it('dusters: replace a unit, capped by mode, type-checked', () => {
    const duster = {
      format: 'blkout-pack',
      formatVersion: 1,
      id: 'mech',
      version: '1.0.0',
      title: 'Mech',
      author: 't',
      requires: [{ id: 'demo', range: '*' }],
      content: {
        units: ['walker', 'strider'].map((id) => ({
          id,
          name: id,
          faction: 'demo:glasswing',
          type: 'duster',
          skill: 6,
          move: 5,
          armor: { dice: 3, target: 5 },
          grunts: 0,
          combatLoads: 0,
          tags: ['outsider'],
        })),
      },
    };
    const l = withPacks(duster);
    const r = base();
    r.groups![0]!.unitIds = ['demo:lantern-wardens', 'demo:choir-hulk'];
    expect(paths({ ...r, dusterId: 'mech:walker' }, l)).toEqual([]);
    expect(paths({ ...r, dusterId: 'demo:lantern-wardens' }, l)).toContain('dusterId:wrong_type');
    // Second duster in the group: units count 3 still, but 2 dusters > max 1 and 2 outsiders > 1.
    r.groups![0]!.unitIds = ['demo:lantern-wardens', 'mech:strider'];
    expect(paths({ ...r, dusterId: 'mech:walker' }, l)).toEqual(['groups.0:limit', 'dusterId:count']);
  });

  it('one handler per group: required / optional / forbidden via handlersPerGroup', () => {
    const variant = (handlersPerGroup: object, groups = { min: 1, max: 2 }) => {
      const d = structuredClone(demo) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      Object.assign(d.content.rulesets[0].rosterModes[0], { handlersPerGroup, groups, unitsPerGroup: { min: 1 }, distinctUnitsPerGroup: false });
      const l = loadPacks([d, other]);
      if (!l.ok) throw new Error('load');
      return l.value.registry;
    };
    const two = (h0?: string, h1?: string): RosterInput => ({
      ...base(),
      groups: [
        { forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens'], ...(h0 ? { handlerId: h0 as never } : {}) },
        { forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens'], ...(h1 ? { handlerId: h1 as never } : {}) },
      ],
    });
    const required = variant({ min: 1, max: 1 });
    expect(paths(two('demo:warden-captain', 'demo:warden-captain'), required)).toEqual([]);
    expect(paths(two('demo:warden-captain'), required)).toEqual(['groups.1.handlerId:handler_count']);
    const optional = variant({ max: 1 });
    expect(paths(two('demo:warden-captain'), optional)).toEqual([]);
    // A second handler smuggled in as a unit breaks "one per group".
    const extra = two('demo:warden-captain');
    extra.groups![0]!.unitIds!.push('demo:warden-captain');
    expect(check(extra, optional).map((i) => i.message)).toEqual(['Matched: at most 1 handler(s) per group (has 2)']);
    const forbidden = variant({ max: 0 });
    expect(check(two(undefined, 'demo:warden-captain'), forbidden).map((i) => `${i.path}:${i.message}`)).toEqual([
      'groups.1.handlerId:Matched: groups may not include a handler',
    ]);
  });

  it('allowedUnitTypes and roster-scope limits', () => {
    const d = structuredClone(demo) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const mode = d.content.rulesets[0].rosterModes[0];
    mode.allowedUnitTypes = ['infantry', 'vehicle', 'handler'];
    mode.limits = [{ key: 'no-vehicles', select: { types: ['vehicle'] }, scope: 'roster', count: { max: 0 }, message: 'No vehicles' }];
    const r = loadPacks([d, other]);
    if (!r.ok) throw new Error('load');
    expect(paths(base(), r.value.registry)).toEqual(['groups.0.unitIds.1:type_not_allowed', ':limit']);
  });
});
