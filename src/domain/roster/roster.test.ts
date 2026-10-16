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
  groups: [{ forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens', 'demo:choir-hulk', 'other-demo:scout-bike'] }],
  handlerId: 'demo:warden-captain',
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
    expect(Roster.safeParse({ ...base(), handlerId: 'warden-captain' }).success).toBe(false);
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
    delete r.handlerId;
    expect(paths(r)).toEqual(['groups.0.forceCardId:count', 'groups.0.unitIds:count', 'handlerId:count']);
    expect(check(r)[1]!.message).toBe('Matched: exactly 3 unit(s) per group required (has 1)');
  });

  it('group count, unresolved refs, duplicates, wrong handler type', () => {
    expect(paths({ ...base(), groups: [] })).toEqual(['groups:count']);
    const r = base();
    r.groups = [{ forceCardId: 'demo:nope', unitIds: ['demo:lantern-wardens', 'demo:lantern-wardens', 'demo:ghost'] }];
    r.handlerId = 'demo:choir-hulk';
    expect(paths(r)).toEqual([
      'handlerId:wrong_type',
      'groups.0.forceCardId:unresolved',
      'groups.0.unitIds.1:duplicate',
      'groups.0.unitIds.2:unresolved',
      'groups.0.unitIds:count', // 0 handlers: the hostile in the handler slot is not one
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
