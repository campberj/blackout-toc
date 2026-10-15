import { describe, expect, it } from 'vitest';
import demo from './__fixtures__/demo-pack.json';
import { Campaign, Ladder, Pool, Table, Track } from './index';

const campaign = () => structuredClone(demo.content.campaigns[0]!) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Campaign', () => {
  it('parses the demo campaign with defaults', () => {
    const c = Campaign.parse(campaign());
    expect(c.timeline.topology).toBe('linear');
    expect(c.ladders[0]!.scope).toBe('operator');
    expect(c.tracks[0]!.milestones[0]!.once).toBe(true);
    expect(c.missions[1]!.aar.fields).toEqual([]);
    expect(c.roster.startingTeams[1]!.operators).toEqual([]);
  });

  it('rejects unknown effect op deep in a mission outcome', () => {
    const c = campaign();
    c.missions[0].outcomes[0].effects.push({ op: 'nuke' });
    const r = Campaign.safeParse(c);
    expect(r.error!.issues[0]!.path).toEqual(['missions', 0, 'outcomes', 0, 'effects', 4, 'op']);
  });

  it('rejects unknown trigger event and duplicate mission keys', () => {
    const c = campaign();
    c.triggers[0].on = 'onFullMoon';
    expect(Campaign.safeParse(c).success).toBe(false);
    const d = campaign();
    d.missions.push(d.missions[0]);
    expect(Campaign.safeParse(d).success).toBe(false);
  });

  it('choice fields need options', () => {
    const c = campaign();
    c.roster.operatorFields[0].options = [];
    expect(Campaign.safeParse(c).success).toBe(false);
  });
});

describe('primitives', () => {
  it('ladder: initial and transitions must reference states', () => {
    const l = { key: 'l', name: 'L', states: [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }], initial: 'a' };
    expect(Ladder.safeParse(l).success).toBe(true);
    expect(Ladder.safeParse({ ...l, initial: 'z' }).success).toBe(false);
    expect(Ladder.safeParse({ ...l, transitions: [{ from: 'a', to: 'z' }] }).success).toBe(false);
    expect(Ladder.safeParse({ ...l, states: [l.states[0]] }).success).toBe(false);
  });
  it('track: initial and milestones within bounds', () => {
    expect(Track.safeParse({ key: 't', name: 'T', max: 5, milestones: [{ key: 'm', at: 5 }] }).success).toBe(true);
    expect(Track.safeParse({ key: 't', name: 'T', max: 5, milestones: [{ key: 'm', at: 6 }] }).success).toBe(false);
    expect(Track.safeParse({ key: 't', name: 'T', max: 5, initial: 9 }).success).toBe(false);
  });
  it('pool refresh uses trigger events', () => {
    expect(Pool.safeParse({ key: 'p', name: 'P', refresh: [{ on: 'onStageStart', mode: 'set', amount: 3 }] }).success).toBe(true);
    expect(Pool.safeParse({ key: 'p', name: 'P', refresh: [{ on: 'daily', mode: 'set', amount: 3 }] }).success).toBe(false);
  });
  it('table entries need effects or narrative and positive weight', () => {
    const t = { id: 't', name: 'T', entries: [{ key: 'e', weight: 1, label: 'E', narrative: { text: 'x' } }] };
    expect(Table.safeParse(t).success).toBe(true);
    expect(Table.safeParse({ ...t, entries: [{ key: 'e', weight: 1, label: 'E' }] }).success).toBe(false);
    expect(Table.safeParse({ ...t, entries: [{ ...t.entries[0], weight: 0 }] }).success).toBe(false);
    expect(Table.safeParse({ ...t, entries: [] }).success).toBe(false);
  });
});
