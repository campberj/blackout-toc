import type { z } from 'zod';
import { Condition, Effect } from '../schema';
import type { Path } from './errors';
import { traverse } from './traverse';

// Shared recursive walker for the Effect/Condition DSL. Exported for engine + authoring tooling:
// any pass that needs "every effect/condition, including nested if/all/any/not" uses this.

export interface DslVisitor {
  /** Return 'skip' to not descend into this node's children. */
  effect?(effect: Effect, path: Path): 'skip' | void;
  condition?(condition: Condition, path: Path): 'skip' | void;
}

export function walkCondition(c: Condition, v: DslVisitor, path: Path = []): void {
  if (v.condition?.(c, path) === 'skip') return;
  if (c.op === 'all' || c.op === 'any') c.of.forEach((x, i) => walkCondition(x, v, [...path, 'of', i]));
  else if (c.op === 'not') walkCondition(c.cond, v, [...path, 'cond']);
}

export function walkEffect(e: Effect, v: DslVisitor, path: Path = []): void {
  if (v.effect?.(e, path) === 'skip') return;
  if (e.op !== 'if') return;
  walkCondition(e.cond, v, [...path, 'cond']);
  walkEffects(e.then, v, [...path, 'then']);
  if (e.else) walkEffects(e.else, v, [...path, 'else']);
}

export function walkEffects(effects: readonly Effect[], v: DslVisitor, path: Path = []): void {
  effects.forEach((e, i) => walkEffect(e, v, [...path, i]));
}

/** Walk every Effect/Condition embedded anywhere in `value` (e.g. a whole Campaign or Table), found via its schema. */
export function walkDslIn(schema: z.core.$ZodType, value: unknown, v: DslVisitor, path: Path = []): void {
  traverse(
    schema,
    value,
    (n) => {
      if (n.schema === Effect) return walkEffect(n.value as Effect, v, n.path), 'skip';
      if (n.schema === Condition) return walkCondition(n.value as Condition, v, n.path), 'skip';
    },
    path,
  );
}
