import { ContentRegistry, loadPacks, parsePack, type LoadedPacks } from '../packs/loader';
import { CONTENT_KEYS, CONTENT_KINDS, type ContentKind, type Pack, type PackDependency } from '../packs/schema';
import { COLLECTIONS, type PackRecord, type Repository, type Storage, type UntypedRecord } from '../ports';
import { err, ok, type Result } from '../domain/result';
import { createEmitter } from './emitter';
import { libraryError, type LibraryError } from './errors';
import type { BundledPackSource } from './ports';

/** Reserved pack id for Forge output (DESIGN §7). */
export const USER_PACK_ID = 'user';
/** Settings record listing disabled bundled packs (bundled packs are never stored). */
export const BUNDLED_STATE_ID = 'bundled-packs';

export interface PackInfo {
  readonly id: string;
  readonly enabled: boolean;
  /** Shipped with the app: read-only, cannot be removed, can be disabled. */
  readonly bundled: boolean;
  readonly version?: string;
  readonly title?: string;
  readonly author?: string;
  readonly license?: string;
  readonly description?: string;
  readonly contentTags: readonly string[];
  readonly requires: readonly PackDependency[];
  readonly counts: Readonly<Partial<Record<ContentKind, number>>>;
  /** Shape errors when the stored JSON no longer parses. */
  readonly errors: readonly LibraryError[];
}

export interface LibrarySnapshot {
  readonly registry: ContentRegistry;
  /** Enabled packs, namespaced + errata-applied, in load order. */
  readonly packs: readonly Pack[];
  /** packId → version of enabled packs. */
  readonly versions: Readonly<Record<string, string>>;
  /** Non-empty ⇒ the enabled set failed to load and `registry` is empty. */
  readonly errors: readonly LibraryError[];
}

export interface ImportResult {
  readonly id: string;
  readonly replaced: boolean;
  readonly snapshot: LibrarySnapshot;
}

export interface PackLibrary {
  /** Load bundled packs and build the first snapshot. Call once at startup. */
  init(): Promise<LibrarySnapshot>;
  readonly snapshot: LibrarySnapshot;
  list(): Promise<PackInfo[]>;
  /** Raw JSON as imported/bundled. */
  raw(id: string): Promise<unknown>;
  exportPack(id: string): Promise<Result<string, LibraryError[]>>;
  /**
   * Validate against the enabled set, then persist. Same id = replace (keeps its enabled state).
   * `enabled` defaults to true for new packs.
   */
  import(input: unknown, opts?: { enabled?: boolean }): Promise<Result<ImportResult, LibraryError[]>>;
  setEnabled(id: string, enabled: boolean): Promise<Result<LibrarySnapshot, LibraryError[]>>;
  remove(id: string): Promise<Result<LibrarySnapshot, LibraryError[]>>;
  rebuild(): Promise<Result<LibrarySnapshot, LibraryError[]>>;
  subscribe(fn: (s: LibrarySnapshot) => void): () => void;
}

interface Entry {
  readonly id: string;
  readonly raw: unknown;
  readonly enabled: boolean;
  readonly bundled: boolean;
}

interface BundledState extends UntypedRecord {
  disabled?: unknown;
}

const idOf = (raw: unknown): string | undefined => {
  const id = typeof raw === 'object' && raw !== null ? (raw as { id?: unknown }).id : undefined;
  return typeof id === 'string' ? id : undefined;
};

const emptyRegistry = (): ContentRegistry => {
  const r = ContentRegistry.fromPacks([]);
  if (!r.ok) throw new Error('unreachable: empty registry');
  return r.value;
};

const snapshotOf = (loaded: LoadedPacks): LibrarySnapshot => ({
  registry: loaded.registry,
  packs: loaded.packs,
  versions: Object.fromEntries(loaded.packs.map((p) => [p.id, p.version])),
  errors: [],
});

const failedSnapshot = (errors: readonly LibraryError[]): LibrarySnapshot => ({ registry: emptyRegistry(), packs: [], versions: {}, errors });

function parseInput(input: unknown): Result<unknown, LibraryError[]> {
  if (typeof input !== 'string') return ok(structuredClone(input));
  try {
    return ok(JSON.parse(input));
  } catch (e) {
    return err([libraryError('json_syntax', `Invalid JSON: ${(e as Error).message}`)]);
  }
}

export function createPackLibrary(storage: Storage, bundledSource: BundledPackSource): PackLibrary {
  const repo: Repository<PackRecord> = storage.collection(COLLECTIONS.packs);
  const settings = storage.collection(COLLECTIONS.settings) as unknown as Repository<BundledState>;
  const changes = createEmitter<LibrarySnapshot>();
  let bundled = new Map<string, unknown>();
  let snapshot = failedSnapshot([]);

  const disabledBundled = async (): Promise<Set<string>> => {
    const rec = await settings.get(BUNDLED_STATE_ID);
    return new Set(Array.isArray(rec?.disabled) ? rec.disabled.filter((x): x is string => typeof x === 'string') : []);
  };

  async function entries(): Promise<Entry[]> {
    const off = await disabledBundled();
    const own = [...bundled].map(([id, raw]) => ({ id, raw, enabled: !off.has(id), bundled: true }));
    // A stored copy of a bundled id (e.g. restored backup) is shadowed by the shipped one.
    const stored = (await repo.list()).filter((r) => !bundled.has(r.id)).map((r) => ({ id: r.id, raw: r.raw, enabled: r.enabled, bundled: false }));
    return [...own, ...stored];
  }

  const load = (es: readonly Entry[]) => loadPacks(es.filter((e) => e.enabled).map((e) => e.raw));

  function commit(next: LibrarySnapshot): LibrarySnapshot {
    snapshot = next;
    changes.emit(next);
    return next;
  }

  async function reload(): Promise<Result<LibrarySnapshot, LibraryError[]>> {
    const r = load(await entries());
    commit(r.ok ? snapshotOf(r.value) : failedSnapshot(r.error));
    return r.ok ? ok(snapshot) : err(r.error);
  }

  /** Enabled packs that declare `id` as a dependency. */
  function dependents(es: readonly Entry[], id: string): LibraryError[] {
    return es
      .filter((e) => e.enabled && e.id !== id)
      .flatMap((e) => {
        const p = parsePack(e.raw);
        const i = p.ok ? p.value.requires.findIndex((r) => r.id === id) : -1;
        return i < 0 ? [] : [libraryError('required_by', `Requires "${id}"; disable "${e.id}" first`, e.id, `/requires/${i}/id`)];
      });
  }

  const find = (es: readonly Entry[], id: string): Result<Entry, LibraryError[]> => {
    const e = es.find((x) => x.id === id);
    return e ? ok(e) : err([libraryError('not_found', `Pack "${id}" is not in the library`, id)]);
  };

  async function setBundledEnabled(id: string, enabled: boolean): Promise<void> {
    const off = await disabledBundled();
    if (enabled) off.delete(id);
    else off.add(id);
    await settings.put({ id: BUNDLED_STATE_ID, disabled: [...off].sort() });
  }

  return {
    async init() {
      const raws = await bundledSource.load();
      bundled = new Map(raws.map((raw, i) => [idOf(raw) ?? `bundled-${i}`, raw]));
      await reload();
      return snapshot;
    },

    get snapshot() {
      return snapshot;
    },

    async list() {
      return (await entries()).map((e): PackInfo => {
        const p = parsePack(e.raw);
        const base = { id: e.id, enabled: e.enabled, bundled: e.bundled };
        if (!p.ok) return { ...base, contentTags: [], requires: [], counts: {}, errors: p.error };
        const v = p.value;
        const counts = Object.fromEntries(
          (Object.keys(CONTENT_KINDS) as ContentKind[]).map((k) => [k, v.content[CONTENT_KEYS[k]].length] as const).filter(([, n]) => n > 0),
        );
        return {
          ...base,
          version: v.version,
          title: v.title,
          author: v.author,
          ...(v.license === undefined ? {} : { license: v.license }),
          ...(v.description === undefined ? {} : { description: v.description }),
          contentTags: v.contentTags,
          requires: v.requires,
          counts,
          errors: [],
        };
      });
    },

    async raw(id) {
      return (await entries()).find((e) => e.id === id)?.raw;
    },

    async exportPack(id) {
      const e = find(await entries(), id);
      return e.ok ? ok(JSON.stringify(e.value.raw, null, 2)) : e;
    },

    async import(input, opts = {}) {
      const raw = parseInput(input);
      if (!raw.ok) return raw;
      const parsed = parsePack(raw.value);
      if (!parsed.ok) return parsed;
      const id = parsed.value.id;
      if (bundled.has(id)) return err([libraryError('read_only', `Pack "${id}" ships with the app and cannot be replaced`, id, '/id')]);

      const es = await entries();
      const existing = es.find((e) => e.id === id);
      const enabled = opts.enabled ?? existing?.enabled ?? true;
      // Validate with the pack included even when it will be stored disabled.
      const others = es.filter((e) => e.id !== id);
      const trial = load([...others, { id, raw: raw.value, enabled: true, bundled: false }]);
      if (!trial.ok) return trial;

      await repo.put({ id, enabled, raw: raw.value });
      if (enabled) commit(snapshotOf(trial.value));
      else await reload();
      return ok({ id, replaced: existing !== undefined, snapshot });
    },

    async setEnabled(id, enabled) {
      const es = await entries();
      const found = find(es, id);
      if (!found.ok) return found;
      const e = found.value;
      if (e.enabled === enabled) return ok(snapshot);
      if (!enabled) {
        const blocked = dependents(es, id);
        if (blocked.length) return err(blocked);
      }
      const trial = load(es.map((x) => (x.id === id ? { ...x, enabled } : x)));
      if (!trial.ok) return trial;
      if (e.bundled) await setBundledEnabled(id, enabled);
      else await repo.put({ id, enabled, raw: e.raw });
      return ok(commit(snapshotOf(trial.value)));
    },

    async remove(id) {
      const es = await entries();
      const found = find(es, id);
      if (!found.ok) return found;
      if (found.value.bundled) return err([libraryError('read_only', `Pack "${id}" ships with the app; disable it instead`, id)]);
      const blocked = dependents(es, id);
      if (found.value.enabled && blocked.length) return err(blocked);
      await repo.delete(id);
      return found.value.enabled ? reload() : ok(snapshot);
    },

    rebuild: reload,
    subscribe: (fn) => changes.subscribe(fn),
  };
}
