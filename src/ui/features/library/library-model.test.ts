import { describe, expect, it } from 'vitest';
import { createAppContext, type LibraryError, type PackInfo } from '../../../app';
import { bundle, fx, memStorage } from '../../../app/__fixtures__';
import { emptyFilter, factionOptions, failingPacks, filterForces, filterUnits, glossary, groupByFaction, typeOptions } from './library-model';

const ctx = () => createAppContext(memStorage(), bundle(fx().other, fx().demo));

const info = (id: string, over: Partial<PackInfo> = {}): PackInfo => ({ id, enabled: true, bundled: false, contentTags: [], requires: [], counts: {}, errors: [], ...over });
const lerr = (packId?: string): LibraryError => ({ code: 'unresolved_ref', path: '', message: 'x', ...(packId ? { packId } : {}) });

describe('failingPacks', () => {
  const packs = [info('a'), info('b'), info('c', { enabled: false }), info('d', { errors: [lerr('d')] })];
  it('returns enabled packs named by errors or with shape errors', () => {
    expect(failingPacks([lerr('b')], packs).map((p) => p.id)).toEqual(['b', 'd']);
  });
  it('falls back to all enabled packs', () => {
    expect(failingPacks([lerr()], [info('a'), info('c', { enabled: false })]).map((p) => p.id)).toEqual(['a']);
  });
});

describe('content filters', async () => {
  const reg = (await ctx()).snapshot().registry;
  const units = reg.list('unit');

  it('filters by query, faction and type', () => {
    expect(filterUnits(units, { ...emptyFilter(), query: 'lamp' }).map((u) => u.id)).toEqual(['demo:lantern-wardens']);
    expect(filterUnits(units, { ...emptyFilter(), factions: ['demo:glasswing'] })).toHaveLength(2);
    expect(filterUnits(units, { ...emptyFilter(), types: ['handler'] }).map((u) => u.name)).toEqual(['Warden Captain']);
  });

  it('hides forces under a type filter', () => {
    const forces = reg.list('force');
    expect(filterForces(forces, emptyFilter())).toHaveLength(1);
    expect(filterForces(forces, { ...emptyFilter(), types: ['infantry'] })).toEqual([]);
  });

  it('groups by faction name and lists options', () => {
    expect(groupByFaction(units, reg).map((g) => g.name)).toEqual(['Dune Runners', 'Glasswing Cooperative', 'Rust Choir']);
    expect(factionOptions(reg).map((o) => o.label)).toContain('Glasswing Cooperative');
    expect(typeOptions(units).map((o) => o.value)).toEqual(['infantry', 'handler', 'vehicle', 'hostile']);
  });

  it('builds a ruleset-aware glossary', () => {
    const rows = glossary(reg, 'demo:house');
    expect(rows.map((r) => r.name)).toEqual(['Ricochet', 'Smolder', 'Tethered']);
    expect(rows[0]).toMatchObject({ text: 'Invented house text.', rulesetText: true, param: true });
    expect(rows[1]).toMatchObject({ rulesetText: false });
    expect(glossary(reg, undefined, 'tether')).toHaveLength(1);
  });
});
