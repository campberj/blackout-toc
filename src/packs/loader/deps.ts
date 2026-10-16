import type { Pack } from '../schema';
import { err, loadError, ok, type LoadError, type Result } from './errors';
import { parseRange } from './semver';

export interface DependencyPlan {
  /** Packs in load order (dependencies first; ties keep input order). */
  readonly order: readonly Pack[];
  /** Pack id → ids of all transitive dependencies. */
  readonly closure: ReadonlyMap<string, ReadonlySet<string>>;
}

export function resolveDependencies(packs: readonly Pack[]): Result<DependencyPlan, LoadError[]> {
  const errors: LoadError[] = [];
  const byId = new Map<string, Pack>();
  packs.forEach((p) => {
    if (byId.has(p.id)) errors.push(loadError('duplicate_pack', ['id'], `Pack "${p.id}" supplied more than once`, p.id));
    else byId.set(p.id, p);
  });

  const edges = new Map<string, string[]>();
  for (const p of byId.values()) {
    const deps: string[] = [];
    p.requires.forEach((r, i) => {
      const at = ['requires', i];
      const range = parseRange(r.range);
      const dep = byId.get(r.id);
      if (!range) errors.push(loadError('invalid_range', [...at, 'range'], `Unparseable semver range "${r.range}"`, p.id));
      if (!dep) errors.push(loadError('missing_dependency', [...at, 'id'], `Requires pack "${r.id}" (${r.range}), which is not loaded`, p.id));
      else if (range && !range.test(dep.version))
        errors.push(loadError('dependency_version', [...at, 'range'], `Requires "${r.id}" ${r.range}; loaded version is ${dep.version}`, p.id));
      if (dep) deps.push(r.id);
    });
    edges.set(p.id, deps);
  }

  // DFS topo sort; grey-node hit = cycle. Iterating input order keeps the result deterministic.
  const state = new Map<string, 'grey' | 'black'>();
  const order: Pack[] = [];
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (id: string): void => {
    const s = state.get(id);
    if (s === 'black') return;
    if (s === 'grey') {
      const cycle = [...stack.slice(stack.indexOf(id)), id];
      const key = [...cycle].slice(0, -1).sort().join(',');
      if (!reported.has(key)) {
        reported.add(key);
        errors.push(loadError('dependency_cycle', ['requires'], `Dependency cycle: ${cycle.join(' → ')}`, id));
      }
      return;
    }
    state.set(id, 'grey');
    stack.push(id);
    edges.get(id)!.forEach(visit);
    stack.pop();
    state.set(id, 'black');
    order.push(byId.get(id)!);
  };
  [...byId.keys()].forEach(visit);
  if (errors.length) return err(errors);

  const closure = new Map<string, Set<string>>();
  for (const p of order) {
    const all = new Set<string>();
    for (const d of edges.get(p.id)!) {
      all.add(d);
      closure.get(d)!.forEach((x) => all.add(x));
    }
    closure.set(p.id, all);
  }
  return ok({ order, closure });
}
