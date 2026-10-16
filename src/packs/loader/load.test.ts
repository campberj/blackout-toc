import { describe, expect, it } from 'vitest';
import { LOAD_ERROR_CODES } from './errors';
import { loadPacks, parsePack } from './load';
import { errorsOf, fixtures, valueOf, type Json } from './test-helpers';

const load = (...packs: Json[]) => loadPacks(packs);
const codes = (packs: Json[]) => errorsOf(loadPacks(packs)).map((e) => e.code);
const base = () => fixtures();

describe('parsePack', () => {
  it('accepts objects and JSON strings', () => {
    const { other } = base();
    expect(valueOf(parsePack(other)).id).toBe('other-demo');
    expect(valueOf(parsePack(JSON.stringify(other))).id).toBe('other-demo');
  });

  it('reports JSON syntax errors at the document root', () => {
    expect(errorsOf(parsePack('{"id": '))).toEqual([expect.objectContaining({ code: 'json_syntax', path: '' })]);
  });

  it('maps Zod issues to JSON pointers with packId', () => {
    const { demo } = base();
    demo.content.units[1].skill = 99;
    demo.content.campaigns[0].roster.stats[0]['a/b~c'] = 1;
    const errs = errorsOf(parsePack(demo));
    expect(errs[0]).toMatchObject({ packId: 'demo', code: 'schema', path: '/content/units/1/skill' });
    expect(errs.some((e) => e.path === '/content/campaigns/0/roster/stats/0')).toBe(true);
  });

  it('omits packId when the input has no string id', () => {
    expect(errorsOf(parsePack({ id: 3 }))[0]!.packId).toBeUndefined();
    expect(errorsOf(parsePack(null))[0]!.packId).toBeUndefined();
  });
});

describe('loadPacks (happy path)', () => {
  it('loads the fixture set in dependency order with qualified ids everywhere', () => {
    const { demo, other, expansion } = base();
    const { packs, registry } = valueOf(load(expansion, demo, other));
    expect(packs.map((p) => p.id)).toEqual(['other-demo', 'demo', 'ember-expansion']);

    const d = packs[1]!.content;
    expect(d.units.map((u) => u.id)).toEqual(['demo:lantern-wardens', 'demo:warden-captain', 'demo:choir-hulk']);
    expect(d.units[0]!.faction).toBe('demo:glasswing');
    expect(d.units[0]!.weapons[0]!.keywords[0]!.key).toBe('demo:ricochet');
    expect(d.units[0]!.keywords[0]!.key).toBe('demo:tethered');
    expect(d.forces[0]!.armory[0]).toMatchObject({ weapon: { keywords: [{ key: 'demo:ricochet' }] } });
    expect(d.keywords[0]!.byRuleset).toEqual({ 'demo:house': 'Invented house text.', 'other-demo:alt': 'Invented alt text.' });
    expect(d.calibrations[0]!.rulesets).toEqual(['demo:house']);
    expect(d.scenarios[0]!.forces.sides[1]!.units[0]!.unit).toBe('demo:choir-hulk');
    const camp = d.campaigns[0]!;
    expect(camp.rulesets).toEqual(['demo:house']);
    expect(camp.roster.nameTable).toBe('demo:names');
    expect(camp.roster.startingTeams[0]!.operators[0]!.unit).toBe('demo:lantern-wardens');
    expect(camp.missions[0]!.scenario).toBe('demo:lamp-recovery');
    expect(camp.missions[0]!.outcomes[0]!.effects[3]).toEqual({ op: 'rollTable', table: 'demo:night-events', times: 1 });
    // Keys untouched.
    expect(camp.missions[0]!.key).toBe('recover-lamp');
    expect(camp.timeline.stages[0]!.slots[0]!.missions).toEqual(['recover-lamp']);
    expect(d.errata[0]!.target).toBe('other-demo:scout-bike');

    // Errata applied in load order, both demo's and the expansion's.
    expect(registry.get('unit', 'other-demo:scout-bike')!.grunts).toBe(2);
    expect(registry.get('keyword', 'other-demo:smolder')!.gist).toBe('Invented corrected gist.');
    expect(registry.get('unit', 'demo:choir-hulk')!.move).toBe(3);
    expect(packs[1]!.content.units[2]!.move).toBe(3);
    // Expansion references across packs.
    const exp = registry.get('campaign', 'ember-expansion:ember-watch')!;
    expect(exp.roster.startingTeams[0]!.operators.map((o) => o.unit)).toEqual(['ember-expansion:ember-scout', 'demo:lantern-wardens']);
  });

  it('accepts JSON strings in the set', () => {
    const { other } = base();
    expect(valueOf(loadPacks([JSON.stringify(other)])).packs).toHaveLength(1);
  });

  it('applies errata sequentially across packs (later wins)', () => {
    const { demo, other, expansion } = base();
    expansion.content.errata.push({ kind: 'unit', target: 'other-demo:scout-bike', set: { grunts: 4 } });
    expansion.requires.push({ id: 'other-demo', range: '^1.2' });
    expect(valueOf(load(demo, other, expansion)).registry.get('unit', 'other-demo:scout-bike')!.grunts).toBe(4);
  });
});

describe('loadPacks (errors, all-or-nothing)', () => {
  it('collects parse errors from every input', () => {
    const { demo, other } = base();
    other.version = 'x';
    const errs = errorsOf(loadPacks([demo, other, '{']));
    expect(errs.map((e) => e.code)).toEqual(['schema', 'json_syntax']);
    expect(errs[0]!.packId).toBe('other-demo');
  });

  it('missing dependency', () => {
    expect(codes([base().demo])).toEqual(['missing_dependency']);
  });

  it('dependency version mismatch', () => {
    const { demo, other } = base();
    other.version = '2.0.0';
    expect(codes([demo, other])).toEqual(['dependency_version']);
  });

  it('unresolved refs of every flavour, with pointer paths', () => {
    const { demo, other } = base();
    const c = demo.content;
    c.units[0].faction = 'nope';
    c.units[0].weapons[0].keywords[0].key = 'other-demo:nope';
    c.campaigns[0].missions[0].outcomes[0].effects[3].table = 'nope';
    c.campaigns[0].missions[0].scenario = 'lantern-wardens'; // wrong kind
    c.keywords[0].byRuleset = { ghost: 'x' };
    const errs = errorsOf(load(demo, other));
    expect(errs.every((e) => e.code === 'unresolved_ref' && e.packId === 'demo')).toBe(true);
    expect(errs.map((e) => e.path).sort()).toEqual(
      [
        '/content/units/0/faction',
        '/content/units/0/weapons/0/keywords/0/key',
        '/content/campaigns/0/missions/0/outcomes/0/effects/3/table',
        '/content/campaigns/0/missions/0/scenario',
        '/content/keywords/0/byRuleset/ghost',
      ].sort(),
    );
  });

  it('ref into a pack that is not loaded at all', () => {
    const { demo, other } = base();
    demo.content.units[0].faction = 'mars:reds';
    expect(codes([demo, other])).toEqual(['unresolved_ref']);
  });

  it('ref into a loaded but undeclared pack', () => {
    const { demo, other, expansion } = base();
    expansion.content.units[0].weapons[0].keywords = [{ key: 'other-demo:smolder' }];
    expansion.requires = [];
    expansion.content.units[0].faction = 'demo:glasswing';
    const errs = errorsOf(load(demo, other, expansion));
    expect(errs.map((e) => e.code)).toContain('undeclared_dependency');
  });

  it('transitive deps count as declared', () => {
    const { demo, other, expansion } = base();
    // expansion → demo → other-demo: smolder ref is fine without a direct requires.
    expect(valueOf(load(demo, other, expansion)).packs).toHaveLength(3);
  });

  it('errata targeting a missing id (in a loaded pack, and in an unloaded pack)', () => {
    const { demo, other } = base();
    demo.content.errata[0].target = 'other-demo:ghost';
    demo.content.errata[1].target = 'mars:x';
    const errs = errorsOf(load(demo, other));
    expect(errs.map((e) => [e.code, e.path])).toEqual([
      ['errata_target_missing', '/content/errata/0/target'],
      ['errata_target_missing', '/content/errata/1/target'],
    ]);
  });

  it('errata patch refs are namespaced and checked', () => {
    const { demo, other } = base();
    demo.content.errata[0].set = { faction: 'glasswing' };
    const { registry } = valueOf(load(demo, other));
    expect(registry.get('unit', 'other-demo:scout-bike')!.faction).toBe('demo:glasswing');
    demo.content.errata[0].set = { faction: 'ghost' };
    expect(codes([demo, other])).toEqual(['unresolved_ref']);
  });

  it('errata on a campaign is re-validated semantically', () => {
    const { demo, other, expansion } = base();
    expansion.content.errata.push({ kind: 'campaign', target: 'demo:long-night', set: { pools: [] } });
    const errs = errorsOf(load(demo, other, expansion));
    expect(errs.every((e) => e.code === 'unresolved_key' && e.packId === 'demo')).toBe(true);
    expect(errs.some((e) => e.message.includes('pool "supply"'))).toBe(true);
  });

  it('never returns a partial result', () => {
    const { demo, other, expansion } = base();
    expansion.content.units[0].faction = 'demo:ghost';
    const r = load(demo, other, expansion);
    expect(r.ok).toBe(false);
    expect('value' in r).toBe(false);
  });

  it('error codes are drawn from LOAD_ERROR_CODES', () => {
    const { demo } = base();
    for (const e of errorsOf(load(demo))) expect(LOAD_ERROR_CODES).toContain(e.code);
  });
});
