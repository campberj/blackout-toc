import type { LibrarySnapshot } from '../../../app';

// Content-filter tag discovery: tags live on packs (contentTags) and on any content entry (`tags`).

function walk(v: unknown, out: Set<string>): void {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, out));
  if (!v || typeof v !== 'object') return;
  for (const [k, x] of Object.entries(v)) {
    if ((k === 'tags' || k === 'contentTags') && Array.isArray(x)) x.forEach((t) => typeof t === 'string' && out.add(t));
    else walk(x, out);
  }
}

/** Every tag used by loaded content, plus already-excluded ones (so they can be re-included). */
export function tagOptions(packs: LibrarySnapshot['packs'], excluded: readonly string[]): { value: string; label: string }[] {
  const tags = new Set<string>(excluded);
  walk(packs, tags);
  return [...tags].sort().map((t) => ({ value: t, label: t.replace(/-/g, ' ') }));
}

/** Free-text tag entry → slug (settings drop anything that is not a valid tag). */
export const normalizeTag = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
