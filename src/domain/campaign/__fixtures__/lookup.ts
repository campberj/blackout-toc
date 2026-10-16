import { CONTENT_KEYS, CONTENT_KINDS, Pack, type ContentKind, type Id, type PackInput } from '$lib/packs/schema';
import type { ContentLookup, ContentOf } from '../../content';


/** Minimal test-only ContentLookup: parses packs and qualifies top-level ids. Not the WP2 loader. */
export function lookupFromPacks(...inputs: unknown[]): ContentLookup {
  const byKind = new Map<ContentKind, Map<string, unknown>>();
  for (const input of inputs) {
    const pack = Pack.parse(input as PackInput);
    for (const kind of Object.keys(CONTENT_KINDS) as ContentKind[]) {
      const m = byKind.get(kind) ?? new Map<string, unknown>();
      for (const item of pack.content[CONTENT_KEYS[kind]] as { id: string }[]) m.set(`${pack.id}:${item.id}`, { ...item, id: `${pack.id}:${item.id}` });
      byKind.set(kind, m);
    }
  }
  return {
    get: <K extends ContentKind>(kind: K, id: Id) => byKind.get(kind)?.get(id) as ContentOf<K> | undefined,
    list: <K extends ContentKind>(kind: K) => [...(byKind.get(kind)?.values() ?? [])] as ContentOf<K>[],
    keywordText: () => undefined,
  };
}
