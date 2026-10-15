import { describe, expect, it } from 'vitest';
import demo from './__fixtures__/demo-pack.json';
import { Errata, Pack, PACK_FORMAT_VERSION } from './index';

const clone = (): Record<string, any> => structuredClone(demo) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const firstIssue = (input: unknown) => {
  const r = Pack.safeParse(input);
  expect(r.success).toBe(false);
  return r.error!.issues[0]!;
};

describe('Pack envelope', () => {
  it('parses the invented demo pack covering every content kind', () => {
    const r = Pack.safeParse(demo);
    if (!r.success) throw new Error(JSON.stringify(r.error.issues, null, 2));
    const c = r.data.content;
    for (const k of ['keywords', 'factions', 'forces', 'units', 'rulesets', 'calibrations', 'scenarios', 'tables', 'campaigns', 'errata'] as const) {
      expect(c[k].length, k).toBeGreaterThan(0);
    }
    expect(r.data.formatVersion).toBe(PACK_FORMAT_VERSION);
  });

  it('applies defaults', () => {
    const p = Pack.parse({ format: 'blkout-pack', formatVersion: 1, id: 'empty', version: '1.0.0', title: 'E', author: 'A' });
    expect(p.requires).toEqual([]);
    expect(p.content.units).toEqual([]);
    const unit = Pack.parse(demo).content.units.find((u) => u.id === 'warden-captain')!;
    expect(unit.specialists).toEqual([]);
    expect(unit.tags).toEqual([]);
  });

  it.each([
    ['Bad Id', ['id']],
    ['demo:x', ['id']],
  ])('rejects pack id %j', (id, path) => {
    const p = clone();
    p.id = id;
    expect(firstIssue(p).path).toEqual(path);
  });

  it('rejects wrong format, formatVersion, semver, unknown keys', () => {
    for (const [k, v] of [['format', 'other'], ['formatVersion', 2], ['version', '1.0'], ['extra', 1]] as const) {
      const p = clone();
      p[k] = v;
      expect(Pack.safeParse(p).success, k).toBe(false);
    }
  });

  it('rejects duplicate content ids', () => {
    const p = clone();
    p.content.factions.push({ ...p.content.factions[0] });
    expect(firstIssue(p).path).toEqual(['content', 'factions', 2, 'id']);
  });

  it('rejects malformed qualified refs', () => {
    const p = clone();
    p.content.units[0].faction = 'Demo:Glasswing';
    expect(firstIssue(p).path).toEqual(['content', 'units', 0, 'faction']);
    p.content.units[0].faction = 'a:b:c';
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it('caps oversized strings', () => {
    const p = clone();
    p.title = 'x'.repeat(500);
    expect(firstIssue(p).path).toEqual(['title']);
  });
});

describe('Errata', () => {
  it('parses partial patches without injecting defaults', () => {
    const e = Errata.parse({ kind: 'unit', target: 'x:y', set: { grunts: 2 } });
    expect(e.set).toEqual({ grunts: 2 });
  });
  it('validates patched field types and rejects id/empty/unknown fields', () => {
    expect(Errata.safeParse({ kind: 'unit', target: 'x:y', set: { grunts: 'two' } }).success).toBe(false);
    expect(Errata.safeParse({ kind: 'unit', target: 'x:y', set: { id: 'z' } }).success).toBe(false);
    expect(Errata.safeParse({ kind: 'unit', target: 'x:y', set: {} }).success).toBe(false);
    expect(Errata.safeParse({ kind: 'unit', target: 'x:y', set: { bogus: 1 } }).success).toBe(false);
    expect(Errata.safeParse({ kind: 'spell', target: 'x:y', set: { a: 1 } }).success).toBe(false);
  });
});
