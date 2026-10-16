/** Resolve a dotted key path the same way IndexedDB does (own props, no array/function traversal). */
export function getPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, key)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Valid exact-match index key shared by both backends. */
export function isIndexValue(v: unknown): v is string | number {
  return typeof v === 'string' || (typeof v === 'number' && !Number.isNaN(v));
}
