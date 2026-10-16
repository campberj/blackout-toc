import { z } from 'zod';
import type { Path } from './errors';

// Generic schema-directed traversal: walks parsed data alongside its Zod schema so loader passes
// (namespacing, ref collection, DSL root discovery) follow the frozen schema instead of hand-kept path lists.

type AnySchema = z.core.$ZodType;
interface Def {
  type: string;
  innerType?: AnySchema;
  getter?: () => AnySchema;
  out?: AnySchema;
  shape?: Record<string, AnySchema>;
  element?: AnySchema;
  keyType?: AnySchema;
  valueType?: AnySchema;
  options?: readonly AnySchema[];
  discriminator?: string;
}
const defOf = (s: AnySchema) => s._zod.def as unknown as Def;

export interface VisitNode {
  readonly schema: AnySchema;
  readonly value: unknown;
  readonly path: Path;
  /** Nearest enclosing property name (array indices keep the array's name). */
  readonly field: string | undefined;
  /** Nearest enclosing object. */
  readonly parent: unknown;
}
/** Return `{replace}` to substitute the value, 'skip' to not descend, or nothing to continue. */
export type Visitor = (n: VisitNode) => { replace: unknown } | 'skip' | void;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const pickOption = (d: Def, value: unknown): AnySchema | undefined => {
  const options = d.options ?? [];
  if (d.discriminator !== undefined) {
    if (!isObj(value)) return undefined;
    const disc = value[d.discriminator];
    return options.find((o) => (o._zod.propValues?.[d.discriminator!] as Set<unknown> | undefined)?.has(disc));
  }
  return options.find((o) => z.safeParse(o, value).success);
};

/** Copy-on-write traversal; returns the (possibly) transformed value. */
export function traverse(
  schema: AnySchema,
  value: unknown,
  visit: Visitor,
  path: Path = [],
  field?: string,
  parent?: unknown,
): unknown {
  const r = visit({ schema, value, path, field, parent });
  if (r === 'skip') return value;
  if (r) return r.replace;
  const d = defOf(schema);
  const next = (s: AnySchema, v: unknown, p: Path, f = field, par = parent) => traverse(s, v, visit, p, f, par);
  switch (d.type) {
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'nonoptional':
    case 'catch':
      return value === undefined || value === null ? value : next(d.innerType!, value, path);
    case 'lazy':
      return next(d.getter!(), value, path);
    case 'pipe':
      return next(d.out!, value, path);
    case 'object': {
      if (!isObj(value)) return value;
      let out = value;
      for (const [k, s] of Object.entries(d.shape!)) {
        if (!(k in value)) continue;
        const nv = next(s, value[k], [...path, k], k, value);
        if (nv !== value[k]) out = out === value ? { ...value, [k]: nv } : Object.assign(out, { [k]: nv });
      }
      return out;
    }
    case 'array': {
      if (!Array.isArray(value)) return value;
      let out: unknown[] = value;
      value.forEach((v, i) => {
        const nv = next(d.element!, v, [...path, i]);
        if (nv !== v) {
          if (out === value) out = [...value];
          out[i] = nv;
        }
      });
      return out;
    }
    case 'record': {
      if (!isObj(value)) return value;
      let changed = false;
      const entries = Object.entries(value).map(([k, v]) => {
        const nk = next(d.keyType!, k, [...path, k], field, value);
        const nv = next(d.valueType!, v, [...path, k], field, value);
        changed ||= nk !== k || nv !== v;
        return [String(nk), nv] as const;
      });
      return changed ? Object.fromEntries(entries) : value;
    }
    case 'union': {
      const opt = pickOption(d, value);
      return opt ? next(opt, value, path) : value;
    }
    default:
      return value;
  }
}

/** Read-only convenience over `traverse`. */
export const visitAll = (schema: AnySchema, value: unknown, visit: (n: VisitNode) => 'skip' | void, path: Path = []): void => {
  traverse(schema, value, visit, path);
};

/** Data-free schema graph walk: every property name whose schema (unwrapped) satisfies `pred`. */
export function fieldsWhere(schema: AnySchema, pred: (s: AnySchema) => boolean): Set<string> {
  const found = new Set<string>();
  const seen = new Set<AnySchema>();
  const go = (s: AnySchema, field: string | undefined): void => {
    if (pred(s)) {
      found.add(field ?? '');
      return;
    }
    if (seen.has(s)) return;
    seen.add(s);
    const d = defOf(s);
    if (d.innerType) go(d.innerType, field);
    if (d.getter) go(d.getter(), field);
    if (d.out) go(d.out, field);
    if (d.element) go(d.element, field);
    if (d.keyType) go(d.keyType, field);
    if (d.valueType) go(d.valueType, field);
    d.options?.forEach((o) => go(o, field));
    if (d.type === 'object') for (const [k, v] of Object.entries(d.shape!)) go(v, k);
  };
  go(schema, undefined);
  return found;
}
