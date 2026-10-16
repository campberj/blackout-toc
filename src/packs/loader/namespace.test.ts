import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Pack } from '../schema';
import { collectRefs, namespacePack, qualify, REF_FIELD_KIND, refFieldNames } from './namespace';
import { fieldsWhere, traverse } from './traverse';
import { fixtures } from './test-helpers';

describe('namespacing', () => {
  it('every Ref field in the schema has a declared target kind (guards future schema additions)', () => {
    expect([...refFieldNames()].sort()).toEqual(Object.keys(REF_FIELD_KIND).sort());
  });

  it('qualify keeps qualified ids', () => {
    expect(qualify('a', 'x')).toBe('a:x');
    expect(qualify('a', 'b:x')).toBe('b:x');
  });

  it('is idempotent and leaves no bare ref behind', () => {
    const p = namespacePack(Pack.parse(fixtures().demo));
    expect(namespacePack(p)).toEqual(p);
    for (const r of collectRefs(p)) expect(r.ref).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
  });

  it('does not mutate the source', () => {
    const src = Pack.parse(fixtures().demo);
    const before = structuredClone(src);
    namespacePack(src);
    expect(src).toEqual(before);
  });

  it('collectRefs throws on an undeclared Ref field (programmer error)', () => {
    const p = Pack.parse(fixtures().demo);
    const saved = REF_FIELD_KIND.faction;
    delete (REF_FIELD_KIND as Record<string, unknown>).faction;
    try {
      expect(() => collectRefs(p)).toThrow(/faction/);
    } finally {
      (REF_FIELD_KIND as Record<string, unknown>).faction = saved;
    }
  });
});

describe('traverse', () => {
  const S = z.object({
    a: z.array(z.string()).optional(),
    l: z.lazy(() => z.string()),
    p: z.string().pipe(z.string()),
    n: z.string().nullable(),
    u: z.union([z.number(), z.string()]),
    d: z.discriminatedUnion('k', [z.object({ k: z.literal('x'), v: z.string() })]),
    r: z.record(z.string(), z.string()),
  });
  const up = (v: unknown) => traverse(S, v, (n) => (typeof n.value === 'string' && n.field !== 'k' ? { replace: n.value.toUpperCase() } : undefined));

  it('handles every wrapper kind and is copy-on-write', () => {
    const v = { a: ['x'], l: 'l', p: 'p', n: null, u: 's', d: { k: 'x', v: 'v' }, r: { k: 'v' } };
    expect(up(v)).toEqual({ a: ['X'], l: 'L', p: 'P', n: null, u: 'S', d: { k: 'x', v: 'V' }, r: { K: 'V' } });
    expect(v.a).toEqual(['x']);
    const same = { l: 1, p: 1, n: 1, u: true, d: 7, r: [], a: {} };
    expect(up(same)).toBe(same);
    expect(up(5)).toBe(5);
    expect(up({ d: { k: 'zzz' } })).toEqual({ d: { k: 'zzz' } });
  });

  it('fieldsWhere tolerates recursive schemas', () => {
    const Node: z.ZodType = z.object({ name: z.string(), get kids() { return z.array(Node); } });
    expect([...fieldsWhere(Node, (s) => s instanceof z.ZodString)]).toEqual(['name']);
  });
});
