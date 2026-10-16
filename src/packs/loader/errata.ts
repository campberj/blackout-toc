import { CONTENT_KINDS, type ContentKind, type Errata, type Pack } from '../schema';
import { CONTENT_KEYS, type ContentItem, KINDS, localOf } from './content-kinds';
import { fromZod, loadError, type LoadError } from './errors';

/** Mutable working set: kind → qualified id → item. Insertion order = load order. */
export type ContentIndex = Map<ContentKind, Map<string, ContentItem>>;

export const indexContent = (packs: readonly Pack[]): ContentIndex => {
  const idx: ContentIndex = new Map(KINDS.map((k) => [k, new Map()]));
  for (const p of packs) for (const k of KINDS) for (const it of p.content[CONTENT_KEYS[k]]) idx.get(k)!.set(it.id, it);
  return idx;
};

/**
 * Apply every pack's errata in load order (shallow merge), re-validating each result against the
 * full kind schema. Mutates `idx`. Targets must already be qualified (namespacePack).
 */
export function applyErrata(order: readonly Pack[], idx: ContentIndex): LoadError[] {
  const errors: LoadError[] = [];
  for (const p of order) {
    p.content.errata.forEach((e: Errata, i) => {
      const at = ['content', 'errata', i];
      const items = idx.get(e.kind)!;
      const target = items.get(e.target);
      if (!target) {
        errors.push(loadError('errata_target_missing', [...at, 'target'], `Errata targets unknown ${e.kind} "${e.target}"`, p.id));
        return;
      }
      // Kind schemas expect a bare LocalId; refs inside stay qualified (Ref accepts both).
      const merged = { ...target, ...e.set, id: localOf(e.target) };
      const r = CONTENT_KINDS[e.kind].safeParse(merged);
      if (!r.success) errors.push(...fromZod(r.error, p.id, [...at, 'set'], 'errata_invalid'));
      else items.set(e.target, { ...r.data, id: e.target });
    });
  }
  return errors;
}

/** Rebuild packs with their (possibly patched) content from the index. */
export const rebuildPacks = (order: readonly Pack[], idx: ContentIndex): Pack[] =>
  order.map((p) => {
    const content = { ...p.content } as Record<string, unknown>;
    for (const k of KINDS) content[CONTENT_KEYS[k]] = p.content[CONTENT_KEYS[k]].map((it) => idx.get(k)!.get(it.id)!);
    return { ...p, content: content as Pack['content'] };
  });
