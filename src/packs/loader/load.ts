import { Pack } from '../schema';
import { CONTENT_KEYS } from './content-kinds';
import { resolveDependencies } from './deps';
import { applyErrata, indexContent, rebuildPacks } from './errata';
import { dedupe, err, fromZod, loadError, ok, type LoadError, type Result } from './errors';
import { checkFormatVersion } from './format-version';
import { namespacePack } from './namespace';
import { ContentRegistry } from './registry';
import { validateCampaign, validateRefs } from './semantic';

const packIdOf = (input: unknown): string | undefined => {
  const id = typeof input === 'object' && input !== null ? (input as { id?: unknown }).id : undefined;
  return typeof id === 'string' ? id : undefined;
};

/** Parse + shape-validate one pack (JSON text or object). Returns source (un-namespaced) form. */
export function parsePack(input: unknown): Result<Pack, LoadError[]> {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      return err([loadError('json_syntax', [], `Invalid JSON: ${(e as Error).message}`)]);
    }
  }
  const r = Pack.safeParse(data);
  if (!r.success) return err(fromZod(r.error, packIdOf(data)));
  const version = checkFormatVersion(r.data);
  return version.length ? err(version) : ok(r.data);
}

export interface LoadedPacks {
  readonly registry: ContentRegistry;
  /** Namespaced, errata-applied packs in dependency load order. */
  readonly packs: readonly Pack[];
}

/** Load a complete pack set. All-or-nothing: any error rejects the whole set. */
export function loadPacks(inputs: readonly unknown[]): Result<LoadedPacks, LoadError[]> {
  const parsed = inputs.map(parsePack);
  const parseErrors = parsed.flatMap((r) => (r.ok ? [] : r.error));
  if (parseErrors.length) return err(parseErrors);
  const sources = parsed.map((r) => (r as { value: Pack }).value);
  const packs = sources.map(namespacePack);

  const plan = resolveDependencies(packs);
  if (!plan.ok) return plan;
  const { order, closure } = plan.value;

  const idx = indexContent(order);
  const loaded = new Set(order.map((p) => p.id));
  // Refs (incl. errata targets + refs inside `set`) checked pre-merge, against each pack's declared deps.
  // Source form keeps error pointers aligned with the author's file (record keys are namespaced too).
  const sourceOf = new Map(sources.map((p) => [p.id, p]));
  const errors: LoadError[] = order.flatMap((p) => validateRefs(sourceOf.get(p.id)!, closure.get(p.id)!, loaded, idx));
  errors.push(...applyErrata(order, idx));
  if (errors.length) return err(dedupe(errors));

  const patched = rebuildPacks(order, idx);
  const locate = (kind: 'table', id: string) => {
    for (const p of patched) {
      const i = p.content[CONTENT_KEYS[kind]].findIndex((t) => t.id === id);
      if (i >= 0) return { packId: p.id, path: ['content', CONTENT_KEYS[kind], i] };
    }
    return undefined;
  };
  // No ref re-check after errata: patched refs come from the original item or from `set`, and both were
  // validated above in their own pack's dependency context. Campaign keys need the patched shape.
  const post = patched.flatMap((p) => p.content.campaigns.flatMap((_, ci) => validateCampaign(p, ci, idx, locate)));
  if (post.length) return err(dedupe(post));

  const registry = ContentRegistry.fromPacks(patched);
  if (!registry.ok) return registry;
  return ok({ registry: registry.value, packs: patched });
}

