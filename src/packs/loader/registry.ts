import type { ContentLookup, ContentOf } from '../../domain/content';
import type { ContentKind, Id, Pack } from '../schema';
import { CONTENT_KEYS, KINDS } from './content-kinds';
import { err, loadError, ok, type LoadError, type Result } from './errors';

const deepFreeze = <T>(v: T): T => {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    Object.values(v).forEach(deepFreeze);
  }
  return v;
};

/** Immutable ContentLookup over namespaced, errata-applied packs. */
export class ContentRegistry implements ContentLookup {
  private readonly byKind: ReadonlyMap<ContentKind, ReadonlyMap<string, unknown>>;
  private readonly lists: ReadonlyMap<ContentKind, readonly unknown[]>;

  private constructor(byKind: Map<ContentKind, Map<string, unknown>>) {
    this.byKind = byKind;
    this.lists = new Map(KINDS.map((k) => [k, Object.freeze([...byKind.get(k)!.values()])]));
    Object.freeze(this);
  }

  /** Build from loaded packs (already namespaced). Duplicate qualified ids are errors. */
  static fromPacks(packs: readonly Pack[]): Result<ContentRegistry, LoadError[]> {
    const errors: LoadError[] = [];
    const byKind = new Map(KINDS.map((k) => [k, new Map<string, unknown>()]));
    for (const p of packs)
      for (const k of KINDS)
        p.content[CONTENT_KEYS[k]].forEach((it, i) => {
          const m = byKind.get(k)!;
          if (m.has(it.id)) errors.push(loadError('duplicate_id', ['content', CONTENT_KEYS[k], i, 'id'], `Duplicate ${k} id "${it.id}"`, p.id));
          else m.set(it.id, deepFreeze(structuredClone(it)));
        });
    return errors.length ? err(errors) : ok(new ContentRegistry(byKind));
  }

  get<K extends ContentKind>(kind: K, id: Id): ContentOf<K> | undefined {
    return this.byKind.get(kind)?.get(id) as ContentOf<K> | undefined;
  }

  list<K extends ContentKind>(kind: K): readonly ContentOf<K>[] {
    return (this.lists.get(kind) ?? []) as readonly ContentOf<K>[];
  }

  keywordText(id: Id, rulesetId?: Id): string | undefined {
    const kw = this.get('keyword', id);
    if (!kw) return undefined;
    return (rulesetId !== undefined ? kw.byRuleset?.[rulesetId] : undefined) ?? kw.gist;
  }
}
