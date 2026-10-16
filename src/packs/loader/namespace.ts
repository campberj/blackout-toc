import { type ContentKind, type Pack, PackContent, Ref } from '../schema';
import { CONTENT_KEYS, KINDS } from './content-kinds';
import type { Path } from './errors';
import { fieldsWhere, traverse, visitAll } from './traverse';

// Refs are found generically by schema identity (`=== Ref`), so new Ref fields are picked up without
// edits here. The schema can't say which kind a Ref targets (one shared Ref schema), so the target kind
// is declared per field name below; a test enumerates every Ref field in the schema against this map.

export const REF_FIELD_KIND: Readonly<Record<string, ContentKind | 'errata-target'>> = {
  faction: 'faction',
  key: 'keyword', // KeywordRef.key
  keywords: 'keyword', // UnitSelector.keywords
  byRuleset: 'ruleset', // Keyword.byRuleset record keys
  rulesets: 'ruleset',
  unit: 'unit',
  scenario: 'scenario',
  table: 'table',
  nameTable: 'table',
  target: 'errata-target', // Errata.target; kind from sibling `kind`
};

const isRef = (s: unknown) => s === Ref;

/** Every property name typed as Ref anywhere in the pack schema (schema introspection; no data). */
export const refFieldNames = (): Set<string> => fieldsWhere(PackContent, isRef);

export const qualify = (packId: string, ref: string): string => (ref.includes(':') ? ref : `${packId}:${ref}`);

/** Qualify every content id and Ref to `packId:localId`. Keys (campaign/card-scoped) are untouched. */
export function namespacePack(pack: Pack): Pack {
  const refs = traverse(PackContent, pack.content, (n) =>
    isRef(n.schema) && typeof n.value === 'string' ? { replace: qualify(pack.id, n.value) } : undefined,
  ) as Pack['content'];
  const content = { ...refs } as Record<string, unknown>;
  for (const kind of KINDS) {
    const key = CONTENT_KEYS[kind];
    content[key] = refs[key].map((it) => ({ ...it, id: qualify(pack.id, it.id) }));
  }
  return { ...pack, content: content as Pack['content'] };
}

export interface RefSite {
  readonly ref: string;
  readonly kind: ContentKind;
  /** JSON path within the pack. */
  readonly path: Path;
  readonly errataTarget: boolean;
}

/** All Ref sites with their target kind, qualified on the fly; paths point into the pack as given (source form). */
export function collectRefs(pack: Pack): RefSite[] {
  const out: RefSite[] = [];
  visitAll(
    PackContent,
    pack.content,
    (n) => {
      if (!isRef(n.schema) || typeof n.value !== 'string') return;
      const declared = REF_FIELD_KIND[n.field ?? ''];
      if (!declared) throw new Error(`Loader: Ref field "${n.field}" has no declared kind (REF_FIELD_KIND)`);
      const errataTarget = declared === 'errata-target';
      const kind = errataTarget ? ((n.parent as { kind: ContentKind }).kind) : declared;
      out.push({ ref: qualify(pack.id, n.value), kind, path: n.path, errataTarget });
    },
    ['content'],
  );
  return out;
}
