import { describe, expect, it } from 'vitest';
import { Pack } from '../schema';
import { applyErrata, indexContent } from './errata';
import { namespacePack } from './namespace';
import { fixtures } from './test-helpers';

describe('applyErrata', () => {
  it('re-validates the merged item with the full kind schema (errata_invalid)', () => {
    const { other } = fixtures();
    const base = namespacePack(Pack.parse(other));
    // Bypass the patch schema to simulate a merge that only the full schema rejects.
    const patcher = { ...base, id: 'patcher', content: { ...base.content, units: [], keywords: [], factions: [], rulesets: [] } } as Pack;
    (patcher.content as { errata: unknown[] }).errata = [{ kind: 'unit', target: 'other-demo:scout-bike', set: { skill: 99 } }];
    const idx = indexContent([base, patcher]);
    const errs = applyErrata([base, patcher], idx);
    expect(errs).toEqual([expect.objectContaining({ code: 'errata_invalid', packId: 'patcher', path: '/content/errata/0/set/skill' })]);
    expect(idx.get('unit')!.get('other-demo:scout-bike')).toMatchObject({ skill: 6 });
  });
});
