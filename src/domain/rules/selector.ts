import type { Count, UnitCard, UnitSelector } from '$lib/packs/schema';

// Shared by Forge checks (FieldCheck.when) and roster limits (RosterMode.limits[].select).

const constrained = (xs: readonly unknown[] | undefined): xs is readonly unknown[] => xs !== undefined && xs.length > 0;

/** Empty/absent selector = every unit. Lists are any-of; all present criteria must hold. */
export function matchesSelector(unit: Pick<UnitCard, 'type' | 'tags' | 'keywords'>, sel: UnitSelector | undefined): boolean {
  if (!sel) return true;
  if (constrained(sel.types) && !sel.types.includes(unit.type)) return false;
  if (sel.exceptTypes?.includes(unit.type)) return false;
  if (constrained(sel.tags) && !sel.tags.some((t) => unit.tags.includes(t))) return false;
  if (constrained(sel.keywords) && !sel.keywords.some((k) => unit.keywords.some((r) => r.key === k))) return false;
  return true;
}

export const outsideCount = (n: number, c: Count): boolean => (c.min !== undefined && n < c.min) || (c.max !== undefined && n > c.max);

/** "exactly 3", "at least 1", "at most 2", "1–3", "any number". */
export function describeCount(c: Count): string {
  const { min, max } = c;
  if (min !== undefined && max !== undefined) return min === max ? `exactly ${min}` : `${min}–${max}`;
  if (min !== undefined) return `at least ${min}`;
  if (max !== undefined) return `at most ${max}`;
  return 'any number';
}
