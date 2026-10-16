import { describe, expect, it } from 'vitest';
import { Pack } from '../schema';
import { checkFormatVersion, V2_FEATURES } from './format-version';
import { loadPacks, parsePack } from './load';
import { collectRefs, namespacePack } from './namespace';
import { walkEffects } from './dsl-walk';
import { errorsOf, fixtures, valueOf, type Json } from './test-helpers';

/** Demo pack at formatVersion 2 with v2 features mutated into its campaign; returns load errors as `code path`. */
const v2 = (mutate: (c: Json, d: Json) => void, version = 2) => {
  const { demo, other } = fixtures();
  demo.formatVersion = version;
  mutate(demo.content.campaigns[0], demo);
  const r = loadPacks([demo, other]);
  return (r.ok ? [] : r.error).map((e) => `${e.code} ${e.path.replace('/content/campaigns/0', '')}`);
};

/** One mutation touching every v2 feature (valid against the demo campaign). */
const everyFeature = (c: Json) => {
  c.factions = [{ key: 'north', name: 'North' }];
  c.customMission = { outcomes: [{ key: 'success', name: 'Done' }] };
  c.triggers.push({ key: 'promo', on: 'onPromotion', filter: { rank: 'veteran' }, effects: [] });
  c.missions[0].outcomes[0].effects.push(
    { op: 'addXp', target: { from: 'team', where: { op: 'hasTag', target: 'subject', tags: ['x'] } }, amount: 1 },
    { op: 'forEachTeam', where: { op: 'teamMissions', value: 3 }, effects: [{ op: 'removeOperator', target: 'subject', reason: 'destroyed' }] },
    { op: 'if', cond: { op: 'factionIs', factions: ['north'] }, then: [{ op: 'rollTable', table: 'night-events', byFaction: [{ faction: 'north', table: 'names' }] }] },
  );
};

describe('format version', () => {
  it('v2 packs may use every v2 feature', () => {
    expect(v2(everyFeature)).toEqual([]);
  });

  it('a v1 pack using v2 features fails with one schema error per feature, naming it', () => {
    const { demo } = fixtures();
    everyFeature(demo.content.campaigns[0]);
    const errs = errorsOf(parsePack(demo));
    expect(errs.every((e) => e.code === 'schema' && e.message.endsWith('is a v2 feature; set formatVersion: 2'))).toBe(true);
    expect(errs.map((e) => e.message.replace(' is a v2 feature; set formatVersion: 2', '')).sort()).toEqual(V2_FEATURES.map((f) => f.name).sort());
    expect(errs.find((e) => e.message.startsWith('effect'))!.path).toBe('/content/campaigns/0/missions/0/outcomes/0/effects/5');
  });

  it('v1 packs without v2 features load; detectors ignore v2 packs', () => {
    const { demo, other } = fixtures();
    expect(demo.formatVersion).toBe(1);
    valueOf(loadPacks([demo, other]));
    demo.formatVersion = 2;
    everyFeature(demo.content.campaigns[0]);
    expect(checkFormatVersion(Pack.parse(demo))).toEqual([]);
  });
});

describe('v2 semantic validation', () => {
  it('faction keys (factionIs, byFaction), trigger rank filter, target filter keys, custom mission AAR fields', () => {
    expect(
      v2((c) => {
        everyFeature(c);
        const e = c.missions[0].outcomes[0].effects;
        e[6].cond.factions = ['south'];
        e[6].then[0].byFaction[0].faction = 'south';
        e[4].target = { from: 'team:ghost', where: { op: 'operatorStat', target: 'subject', stat: 'ghost', value: 1 } };
        c.triggers.at(-1).filter.rank = 'general';
        c.triggers[1].filter = { rank: 'veteran' }; // onOperatorKia
        c.customMission.aar = { fields: [{ key: 'n', label: 'N', kind: 'text', scope: 'mission', perUnit: [{ op: 'adjustPool', pool: 'ghost', amount: 1 }] }] };
      }),
    ).toEqual([
      'unresolved_key /missions/0/outcomes/0/effects/4/target/from',
      'unresolved_key /missions/0/outcomes/0/effects/4/target/where/stat',
      'unresolved_key /missions/0/outcomes/0/effects/6/cond/factions/0',
      'unresolved_key /missions/0/outcomes/0/effects/6/then/0/byFaction/0/faction',
      'unresolved_key /customMission/aar/fields/0/perUnit/0/pool',
      'invalid_value /triggers/1/filter/rank',
      'unresolved_key /triggers/3/filter/rank',
      'invalid_value /customMission/aar/fields/0/perUnit',
    ]);
  });

  it('byFaction tables are namespaced, ref-checked, and reachable for key validation', () => {
    const { demo } = fixtures();
    demo.formatVersion = 2;
    everyFeature(demo.content.campaigns[0]);
    const p = namespacePack(Pack.parse(demo));
    const effects = p.content.campaigns[0]!.missions[0]!.outcomes[0]!.effects;
    const tables: string[] = [];
    walkEffects(effects, { effect: (e) => void (e.op === 'rollTable' && tables.push(...(e.byFaction ?? []).map((f) => f.table))) });
    expect(tables).toEqual(['demo:names']);
    expect(collectRefs(Pack.parse(demo)).some((r) => r.kind === 'table' && r.path.join('/').includes('byFaction'))).toBe(true);
    expect(v2((c) => (everyFeature(c), (c.missions[0].outcomes[0].effects[6].then[0].byFaction[0].table = 'ghost')))).toEqual([
      'unresolved_ref /missions/0/outcomes/0/effects/6/then/0/byFaction/0/table',
    ]);
    // A faction table's effects are validated in the rolling campaign's context.
    expect(
      v2((c, d) => {
        everyFeature(c);
        d.content.tables[1].entries[0].effects = [{ op: 'adjustPool', pool: 'ghost', amount: 1 }];
      }),
    ).toEqual(['unresolved_key /content/tables/1/entries/0/effects/0/pool']);
  });
});
