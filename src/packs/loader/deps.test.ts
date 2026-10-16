import { describe, expect, it } from 'vitest';
import { Pack } from '../schema';
import { resolveDependencies } from './deps';
import { errorsOf, valueOf } from './test-helpers';

const pack = (id: string, version = '1.0.0', requires: { id: string; range: string }[] = []) =>
  Pack.parse({ format: 'blkout-pack', formatVersion: 1, id, version, title: id, author: 'T', requires });

describe('resolveDependencies', () => {
  it('orders dependencies first, keeps input order for ties, computes transitive closure', () => {
    const plan = valueOf(resolveDependencies([pack('c', '1.0.0', [{ id: 'b', range: '^1' }]), pack('a'), pack('b', '1.4.0', [{ id: 'a', range: '>=1' }])]));
    expect(plan.order.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect([...plan.closure.get('c')!].sort()).toEqual(['a', 'b']);
    expect(plan.closure.get('a')!.size).toBe(0);
  });

  it('reports missing deps, version mismatch, bad ranges, duplicates', () => {
    const errs = errorsOf(
      resolveDependencies([
        pack('a', '2.0.0'),
        pack('a'),
        pack('b', '1.0.0', [{ id: 'a', range: '^1' }, { id: 'ghost', range: '1' }]),
        pack('c', '1.0.0', [{ id: 'a', range: '>>1' }]),
      ]),
    );
    expect(errs.map((e) => [e.packId, e.code, e.path])).toEqual([
      ['a', 'duplicate_pack', '/id'],
      ['b', 'dependency_version', '/requires/0/range'],
      ['b', 'missing_dependency', '/requires/1/id'],
      ['c', 'invalid_range', '/requires/0/range'],
    ]);
  });

  it('detects cycles once, incl. self-dependency', () => {
    const errs = errorsOf(
      resolveDependencies([
        pack('a', '1.0.0', [{ id: 'b', range: '*' }]),
        pack('b', '1.0.0', [{ id: 'c', range: '*' }]),
        pack('c', '1.0.0', [{ id: 'a', range: '*' }]),
        pack('s', '1.0.0', [{ id: 's', range: '*' }]),
      ]),
    );
    expect(errs.map((e) => e.code)).toEqual(['dependency_cycle', 'dependency_cycle']);
    expect(errs[0]!.message).toContain('a → b → c → a');
    expect(errs[1]!.message).toContain('s → s');
  });
});
