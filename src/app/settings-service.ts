import { z } from 'zod';
import { Id, Tag, Tags } from '../packs/schema';
import type { ContentLookup } from '../domain/content';
import { COLLECTIONS, type Repository, type Storage } from '../ports';
import { createEmitter } from './emitter';
import type { ThemeChoice, ThemePort } from './ports';

export const SETTINGS_ID = 'app';
/** Preferred default ruleset (D10): any loaded ruleset whose id ends with this. */
export const DEFAULT_RULESET_SUFFIX = ':supplemental-2026';

const AppSettingsSchema = z.object({
  /** Explicit choice; null = default resolution. */
  activeRulesetId: Id.nullable().catch(null).default(null),
  excludedTags: Tags.catch([]),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;
type SettingsRecord = AppSettings & { id: string };

const DEFAULTS: AppSettings = { activeRulesetId: null, excludedTags: [] };

export interface SettingsService {
  load(): Promise<AppSettings>;
  readonly current: AppSettings;
  setActiveRuleset(id: Id | null): Promise<AppSettings>;
  setExcludedTags(tags: readonly string[]): Promise<AppSettings>;
  /** Stored choice if loaded, else `*:supplemental-2026`, else the first ruleset, else undefined. */
  resolveRuleset(lookup: ContentLookup): Id | undefined;
  readonly theme: ThemePort;
  subscribe(fn: (s: AppSettings) => void): () => void;
}

/** In-memory theme when no UI theme store is injected (tests). */
const memoryTheme = (): ThemePort => {
  let choice: ThemeChoice = 'dark';
  return { get: () => choice, set: (c) => (choice = c) };
};

export function createSettingsService(storage: Storage, theme: ThemePort = memoryTheme()): SettingsService {
  const repo = storage.collection(COLLECTIONS.settings) as unknown as Repository<SettingsRecord>;
  const changes = createEmitter<AppSettings>();
  let current: AppSettings = DEFAULTS;

  async function save(patch: Partial<AppSettings>): Promise<AppSettings> {
    current = { ...current, ...patch };
    await repo.put({ id: SETTINGS_ID, ...current });
    changes.emit(current);
    return current;
  }

  return {
    async load() {
      const r = AppSettingsSchema.safeParse((await repo.get(SETTINGS_ID)) ?? {});
      current = r.success ? r.data : DEFAULTS;
      return current;
    },
    get current() {
      return current;
    },
    setActiveRuleset: (activeRulesetId) => save({ activeRulesetId }),
    // Invalid tags can never match content (tags are slugs), so they are dropped.
    setExcludedTags: (tags) => save({ excludedTags: [...new Set(tags)].filter((t) => Tag.safeParse(t).success).sort() }),
    resolveRuleset(lookup) {
      const all = lookup.list('ruleset');
      if (current.activeRulesetId && lookup.get('ruleset', current.activeRulesetId)) return current.activeRulesetId;
      return (all.find((r) => r.id.endsWith(DEFAULT_RULESET_SUFFIX)) ?? all[0])?.id as Id | undefined;
    },
    theme,
    subscribe: (fn) => changes.subscribe(fn),
  };
}
