import { describe, expect, it } from 'vitest';
import type { ContentLookup } from '../../domain/content';
import { Pack } from '../schema';
import { loadPacks } from './load';
import { namespacePack } from './namespace';
import { ContentRegistry } from './registry';
import { errorsOf, fixtures, valueOf } from './test-helpers';

const registry = (): ContentLookup => {
  const { demo, other, expansion } = fixtures();
  return valueOf(loadPacks([demo, other, expansion])).registry;
};

describe('ContentRegistry', () => {
  it('get/list by kind with qualified ids', () => {
    const r = registry();
    expect(r.get('faction', 'demo:glasswing')!.name).toBe('Glasswing Cooperative');
    expect(r.get('faction', 'other-demo:glasswing')).toBeUndefined();
    expect(r.list('unit').map((u) => u.id)).toEqual([
      'other-demo:scout-bike',
      'demo:lantern-wardens',
      'demo:warden-captain',
      'demo:choir-hulk',
      'ember-expansion:ember-scout',
    ]);
    expect(r.list('calibration')).toHaveLength(1);
  });

  it('keywordText: ruleset text, else gist; unknown keyword undefined', () => {
    const r = registry();
    expect(r.keywordText('demo:ricochet', 'demo:house')).toBe('Invented house text.');
    expect(r.keywordText('demo:ricochet', 'other-demo:alt')).toBe('Invented alt text.');
    expect(r.keywordText('demo:ricochet', 'other-demo:none')).toBe('Invented: bounces to X extra targets.');
    expect(r.keywordText('demo:ricochet')).toBe('Invented: bounces to X extra targets.');
    expect(r.keywordText('demo:ghost')).toBeUndefined();
  });

  it('is deeply immutable', () => {
    const r = registry();
    const u = r.get('unit', 'demo:lantern-wardens')!;
    expect(() => ((u as { skill: number }).skill = 1)).toThrow(TypeError);
    expect(() => (u.weapons as unknown[]).push({})).toThrow(TypeError);
    expect(() => (r.list('unit') as unknown[]).pop()).toThrow(TypeError);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('is isolated from later mutation of its source packs', () => {
    const p = namespacePack(Pack.parse(fixtures().other));
    const r = valueOf(ContentRegistry.fromPacks([p]));
    (p.content.units[0] as { skill: number }).skill = 2;
    expect(r.get('unit', 'other-demo:scout-bike')!.skill).toBe(6);
  });

  it('rejects duplicate qualified ids', () => {
    const p = namespacePack(Pack.parse(fixtures().other));
    // Same pack twice bypasses loadPacks' duplicate_pack guard.
    expect(errorsOf(ContentRegistry.fromPacks([p, p])).map((e) => [e.code, e.path])).toEqual([
      ['duplicate_id', '/content/keywords/0/id'],
      ['duplicate_id', '/content/factions/0/id'],
      ['duplicate_id', '/content/units/0/id'],
      ['duplicate_id', '/content/rulesets/0/id'],
    ]);
  });

  it('loadPacks reports duplicate packs', () => {
    const { other } = fixtures();
    expect(errorsOf(loadPacks([other, other])).map((e) => e.code)).toEqual(['duplicate_pack']);
  });
});
