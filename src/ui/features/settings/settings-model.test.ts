import { describe, expect, it } from 'vitest';
import { createAppContext } from '../../../app';
import { bundle, fx, memStorage } from '../../../app/__fixtures__';
import { normalizeTag, tagOptions } from './settings-model';

describe('settings model', () => {
  it('collects pack and entry tags plus excluded ones', async () => {
    const ctx = await createAppContext(memStorage(), bundle(fx().other, fx().demo));
    const values = tagOptions(ctx.snapshot().packs, ['gore']).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['fiction', 'test', 'hostile', 'gore']));
    expect(values).toEqual([...values].sort());
  });
  it('normalizes typed tags', () => {
    expect(normalizeTag('  Mature Themes! ')).toBe('mature-themes');
  });
});
