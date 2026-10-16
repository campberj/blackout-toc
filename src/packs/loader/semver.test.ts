import { describe, expect, it } from 'vitest';
import { compare, parseRange, parseVersion, satisfies } from './semver';

describe('semver', () => {
  it('parses versions and rejects junk', () => {
    expect(parseVersion('1.2.3-beta.4+build')).toEqual({ major: 1, minor: 2, patch: 3, pre: ['beta', 4] });
    expect(parseVersion('1.2')).toBeUndefined();
  });

  it('orders versions incl. prereleases', () => {
    const v = (s: string) => parseVersion(s)!;
    const sorted = ['1.0.0', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '0.9.9']
      .map(v)
      .sort(compare)
      .map((x) => `${x.major}.${x.minor}.${x.patch}${x.pre.length ? '-' + x.pre.join('.') : ''}`);
    expect(sorted).toEqual(['0.9.9', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0']);
  });

  it.each([
    ['1.2.3', '1.2.3', true],
    ['=1.2.3', '1.2.4', false],
    ['^1', '1.9.0', true],
    ['^1', '2.0.0', false],
    ['^1.2.3', '1.2.2', false],
    ['^1.2.3', '1.99.0', true],
    ['^0.2.3', '0.2.9', true],
    ['^0.2.3', '0.3.0', false],
    ['^0.0.3', '0.0.4', false],
    ['^0.0', '0.0.9', true],
    ['^0.0', '0.1.0', false],
    ['^0', '0.9.0', true],
    ['^x.1', '5.0.0', true],
    ['~1.2.3', '1.2.9', true],
    ['~1.2.3', '1.3.0', false],
    ['~1', '1.9.9', true],
    ['~1', '2.0.0', false],
    ['>=1.2.0', '1.2.0', true],
    ['>=1.2', '1.1.9', false],
    ['>1.2', '1.2.9', false],
    ['>1.2', '1.3.0', true],
    ['>1.2.3', '1.2.4', true],
    ['<2', '1.99.0', true],
    ['<2', '2.0.0', false],
    ['<=1.2', '1.2.9', true],
    ['<=1.2', '1.3.0', false],
    ['<=1.2.3', '1.2.3', true],
    ['1.x', '1.5.0', true],
    ['1.2.X', '1.3.0', false],
    ['*', '9.9.9', true],
    ['', '0.0.1', true],
    ['>= 1.2.0 < 2', '1.5.0', true],
    ['>=1.2.0 <2', '2.0.0', false],
    ['1 || 3', '3.1.0', true],
    ['1 || 3', '2.1.0', false],
    ['1.0.0 - 1.2', '1.2.9', true],
    ['1.0.0 - 1.2.0', '1.2.1', false],
    ['1 - *', '7.0.0', true],
    ['>=*', '1.0.0', true],
    ['^1.0.0-beta.1', '1.0.0-beta.2', true],
    ['^1.0.0-beta.1', '1.1.0-beta.1', false],
    ['^1', '1.5.0-rc.1', false],
    ['^1', 'not-a-version', false],
  ])('%j matches %s → %s', (range, version, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it('accepts parsed versions directly', () => {
    expect(parseRange('^1')!.test(parseVersion('1.2.3')!)).toBe(true);
  });

  it.each(['abc', '=>1', '1.2.3-', '>*', '<x', '1.2.3.4', 'a - 1', '1 - b'])('rejects malformed range %j', (r) => {
    expect(parseRange(r)).toBeUndefined();
    expect(satisfies('1.0.0', r)).toBe(false);
  });
});
