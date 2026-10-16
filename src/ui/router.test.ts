// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { href, parseHash, parseQuery } from './router.svelte';

describe('router query', () => {
  it('round-trips ids', () => {
    const h = href('/campaign', { save: 'a b&c', mission: 'first-light' });
    expect(parseHash(h)).toBe('/campaign');
    expect(parseQuery(h)).toEqual({ save: 'a b&c', mission: 'first-light' });
  });
  it('no query', () => expect(parseQuery('#/roster')).toEqual({}));
});
