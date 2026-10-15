import { describe, expect, it } from 'vitest';
import { formatArmor, formatKeywordList, formatKeywordRef, formatWeaponProfile, humanizeKey, parseArmor } from './format';

describe('armor', () => {
  it('parses and round-trips', () => {
    expect(parseArmor('2/6')).toEqual({ dice: 2, target: 6 });
    expect(parseArmor(' 1 / 7+ ')).toEqual({ dice: 1, target: 7 });
    expect(formatArmor({ dice: 3, target: 5 })).toBe('3/5');
    expect(formatArmor(parseArmor('2/6')!)).toBe('2/6');
  });
  it.each(['', '2', '2/', 'x/6', '4/6', '0/6', '1/11', '1/1', '2-6'])('rejects %j', (s) => {
    expect(parseArmor(s)).toBeNull();
  });
});

describe('formatWeaponProfile', () => {
  it.each([
    [{ minRange: 4, maxRange: 16, damage: 2 }, '4-16"/2'],
    [{ maxRange: 24, damage: 1 }, '24"/1'],
    [{ minRange: 0, maxRange: 24, damage: 1 }, '24"/1'],
    [{ maxRange: 12 }, '12"'],
    [{ damage: 3 }, '—/3'],
    [{}, ''],
  ])('%j → %s', (w, out) => {
    expect(formatWeaponProfile(w)).toBe(out);
  });
});

describe('keywords', () => {
  it('formats with and without param', () => {
    expect(formatKeywordRef({ key: 'core:blast', x: 1 })).toBe('Blast (1)');
    expect(formatKeywordRef({ key: 'core:data-knife' })).toBe('Data Knife');
    expect(formatKeywordRef({ key: 'local-only', x: 0 })).toBe('Local Only (0)');
  });
  it('prefers resolved names', () => {
    const names: Record<string, string> = { 'demo:ap': 'AP' };
    expect(formatKeywordRef({ key: 'demo:ap', x: 2 }, (k) => names[k])).toBe('AP (2)');
    expect(formatKeywordList([{ key: 'demo:ap', x: 1 }, { key: 'demo:cqb' }], (k) => names[k])).toBe('AP (1), Cqb');
  });
  it('humanizes keys', () => {
    expect(humanizeKey('a:b-c-d')).toBe('B C D');
  });
});
