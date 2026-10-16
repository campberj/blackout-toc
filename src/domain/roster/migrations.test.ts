import { describe, expect, it } from 'vitest';
import { COLLECTIONS } from '$lib/ports';
import { Roster, ROSTER_MIGRATIONS, ROSTER_SCHEMA_VERSION, rosterV1toV2 } from '.';

const v1 = (over: Record<string, unknown> = {}) => ({
  id: 'r',
  name: 'Old Team',
  rulesetId: 'demo:house',
  mode: 'matched',
  handlerId: 'demo:warden-captain',
  groups: [{ forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens'] }, { unitIds: [] }],
  notes: '',
  ...over,
});

describe('rosterV1toV2', () => {
  it('moves the roster-level handler into groups[0] without mutating input', () => {
    const old = v1();
    const snapshot = structuredClone(old);
    const next = rosterV1toV2(old) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(old).toEqual(snapshot);
    expect(next.handlerId).toBeUndefined();
    expect(next.groups[0]).toEqual({ forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens'], handlerId: 'demo:warden-captain' });
    expect(next.groups[1]).toEqual({ unitIds: [] });
    expect(Roster.safeParse(next).success).toBe(true);
  });

  it('edge cases: no groups, no handler, existing group handler, junk', () => {
    expect((rosterV1toV2(v1({ groups: undefined })) as { groups: unknown }).groups).toEqual([{ unitIds: [], handlerId: 'demo:warden-captain' }]);
    const noHandler = v1();
    delete (noHandler as Record<string, unknown>).handlerId;
    expect(rosterV1toV2(noHandler)).toBe(noHandler);
    const taken = rosterV1toV2(v1({ groups: [{ handlerId: 'demo:other', unitIds: [] }] })) as { groups: { handlerId: string }[] };
    expect(taken.groups[0]!.handlerId).toBe('demo:other');
    expect(rosterV1toV2(v1({ handlerId: 7 }))).not.toHaveProperty('handlerId');
    expect((rosterV1toV2(v1({ groups: ['junk'] })) as { groups: unknown[] }).groups).toEqual(['junk']);
    expect(rosterV1toV2(null)).toBeNull();
  });

  it('is registered on the rosters collection', () => {
    expect(ROSTER_SCHEMA_VERSION).toBe(2);
    expect(COLLECTIONS.rosters.schemaVersion).toBe(ROSTER_SCHEMA_VERSION);
    expect(COLLECTIONS.rosters.migrations).toBe(ROSTER_MIGRATIONS);
    // End-to-end read through storage: src/app/roster-service.test.ts.
  });
});
