import type { z } from 'zod';
import type { CONTENT_KINDS, ContentKind, Id } from '$lib/packs/schema';

/** Parsed content type for a kind, with all ids fully qualified (`packId:localId`). */
export type ContentOf<K extends ContentKind> = z.output<(typeof CONTENT_KINDS)[K]>;

/**
 * Read-only view of all loaded, namespaced, errata-applied content.
 * Implemented by the pack loader (WP2); consumed by engine (WP4) and features.
 * The only contract between them: never import loader internals from domain.
 */
export interface ContentLookup {
  get<K extends ContentKind>(kind: K, id: Id): ContentOf<K> | undefined;
  list<K extends ContentKind>(kind: K): readonly ContentOf<K>[];
  /** Keyword text for a ruleset, falling back to the keyword's gist. */
  keywordText(id: Id, rulesetId?: Id): string | undefined;
}
