import { z } from 'zod';
import {
  createCampaignEngine,
  type CampaignCommandInput,
  type CampaignEngine,
  type CampaignEvent,
  type CampaignState,
  type MissionView,
  type StartCampaignInput,
} from '../domain/campaign';
import { err, ok, type Result } from '../domain/result';
import { Id, Name, Semver, Slug, type Pack } from '../packs/schema';
import { COLLECTIONS, type Clock, type Repository, type Storage } from '../ports';
import type { LibrarySnapshot } from './pack-library';
import type { IdSource, SeedSource } from './ports';

// Campaign saves: event log + metadata, write-through on every accepted command (DESIGN §6, §8).

const StoredEvent = z.object({ seq: z.number().int().min(1), type: z.string().min(1), at: z.string().optional(), payload: z.unknown() });

export const CampaignSave = z.object({
  id: z.string().min(1).max(64),
  name: Name,
  campaignId: Id,
  /** packId → version at creation (mirrors CampaignStarted.packs). */
  packVersions: z.record(Slug, Semver),
  events: z.array(StoredEvent),
  createdAt: z.string(),
});
export type CampaignSave = z.infer<typeof CampaignSave>;

export const CAMPAIGN_EXPORT_FORMAT = 'blkout-campaign-save';
const CampaignExport = z.object({ format: z.literal(CAMPAIGN_EXPORT_FORMAT), version: z.literal(1), save: CampaignSave });

export interface PackDrift {
  readonly packId: string;
  readonly expected: string;
  /** null = pack no longer loaded. */
  readonly actual: string | null;
}

export interface OpenCampaign {
  readonly save: CampaignSave;
  readonly state: CampaignState;
  readonly available: MissionView[];
  /** Pack versions differ from campaign start: replay may diverge. Warning only. */
  readonly drift: readonly PackDrift[];
}

export interface CampaignSaveSummary {
  readonly id: string;
  readonly name: string;
  readonly campaignId: string;
  readonly createdAt: string;
  readonly events: number;
  readonly lastAt: string | null;
}

export interface CreateCampaignInput {
  readonly name: string;
  readonly campaign: Id;
  readonly teams: StartCampaignInput['teams'];
  readonly excludedTags?: string[];
  /** Override for reproducible tests; defaults to the injected SeedSource. */
  readonly seed?: number;
}

export interface CampaignService {
  list(): Promise<CampaignSaveSummary[]>;
  create(input: CreateCampaignInput): Promise<Result<OpenCampaign, string>>;
  open(id: string): Promise<Result<OpenCampaign, string>>;
  dispatch(id: string, command: CampaignCommandInput): Promise<Result<OpenCampaign & { events: CampaignEvent[] }, string>>;
  /** Dry run (e.g. AAR preview); nothing persisted. */
  preview(id: string, command: CampaignCommandInput): Promise<Result<{ state: CampaignState; events: CampaignEvent[] }, string>>;
  /** Drop the last event. Refuses to remove CampaignStarted (delete the save instead). */
  undo(id: string): Promise<Result<OpenCampaign, string>>;
  rename(id: string, name: string): Promise<Result<CampaignSave, string>>;
  remove(id: string): Promise<void>;
  exportSave(id: string): Promise<Result<string, string>>;
  /** Validates envelope + event payloads; gets a fresh id if it collides. */
  importSave(input: unknown): Promise<Result<OpenCampaign, string>>;
}

export interface CampaignServiceDeps {
  readonly storage: Storage;
  readonly content: () => LibrarySnapshot;
  readonly clock: Clock;
  readonly newId: IdSource;
  readonly newSeed: SeedSource;
  /** Default content filter for new campaigns (settings). */
  readonly excludedTags?: () => readonly string[];
}

const packOf = (id: string) => id.slice(0, id.indexOf(':'));

/** Campaign pack + its transitive dependencies, at their loaded versions. */
export function campaignPackVersions(campaignId: Id, packs: readonly Pack[]): Record<string, string> {
  const byId = new Map(packs.map((p) => [p.id, p]));
  const out: Record<string, string> = {};
  const visit = (id: string) => {
    const p = byId.get(id);
    if (!p || out[id]) return;
    out[id] = p.version;
    p.requires.forEach((r) => visit(r.id));
  };
  visit(packOf(campaignId));
  return out;
}

export function packDrift(recorded: Readonly<Record<string, string>>, loaded: Readonly<Record<string, string>>): PackDrift[] {
  return Object.entries(recorded)
    .filter(([id, v]) => loaded[id] !== v)
    .map(([packId, expected]) => ({ packId, expected, actual: loaded[packId] ?? null }));
}

function parseJson(input: unknown): Result<unknown, string> {
  if (typeof input !== 'string') return ok(input);
  try {
    return ok(JSON.parse(input));
  } catch (e) {
    return err(`Invalid JSON: ${(e as Error).message}`);
  }
}

const zodMessage = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

export function createCampaignService(deps: CampaignServiceDeps): CampaignService {
  const repo = deps.storage.collection(COLLECTIONS.campaigns) as unknown as Repository<CampaignSave>;
  // Engines cached per save, invalidated when the registry changes (pack enable/import).
  const engines = new Map<string, { registry: unknown; engine: CampaignEngine }>();
  const at = () => deps.clock.now().toISOString();

  function engineFor(save: CampaignSave): Result<CampaignEngine, string> {
    const { registry } = deps.content();
    const hit = engines.get(save.id);
    if (hit && hit.registry === registry) return ok(hit.engine);
    const engine = createCampaignEngine(registry);
    const r = engine.load(save.events as CampaignEvent[]);
    if (!r.ok) return err(r.error);
    engines.set(save.id, { registry, engine });
    return ok(engine);
  }

  const view = (save: CampaignSave, engine: CampaignEngine): OpenCampaign => ({
    save,
    state: engine.state,
    available: engine.availableMissions(),
    drift: packDrift(engine.state.packs, deps.content().versions),
  });

  async function read(id: string): Promise<Result<CampaignSave, string>> {
    const raw = await repo.get(id);
    if (!raw) return err(`Campaign save "${id}" not found`);
    const r = CampaignSave.safeParse(raw);
    return r.success ? ok(r.data) : err(`Campaign save "${id}" is corrupt: ${zodMessage(r.error)}`);
  }

  async function withEngine<T>(id: string, fn: (save: CampaignSave, engine: CampaignEngine) => Promise<Result<T, string>> | Result<T, string>) {
    const save = await read(id);
    if (!save.ok) return save;
    const engine = engineFor(save.value);
    if (!engine.ok) return engine;
    return fn(save.value, engine.value);
  }

  async function persist(save: CampaignSave, engine: CampaignEngine): Promise<CampaignSave> {
    const next = { ...save, events: [...engine.events] };
    try {
      await repo.put(next);
    } catch (e) {
      engines.delete(save.id); // engine is ahead of storage; reload from storage next time
      throw e;
    }
    return next;
  }

  return {
    async list() {
      const saves = (await repo.list()).flatMap((s) => {
        const r = CampaignSave.safeParse(s);
        return r.success ? [r.data] : [];
      });
      return saves.map((s) => ({
        id: s.id,
        name: s.name,
        campaignId: s.campaignId,
        createdAt: s.createdAt,
        events: s.events.length,
        lastAt: s.events.at(-1)?.at ?? null,
      }));
    },

    async create(input) {
      const name = Name.safeParse(input.name);
      if (!name.success) return err(`Name: ${zodMessage(name.error)}`);
      const snap = deps.content();
      const packVersions = campaignPackVersions(input.campaign, snap.packs);
      const engine = createCampaignEngine(snap.registry);
      const r = engine.start(
        {
          campaign: input.campaign,
          seed: input.seed ?? deps.newSeed(),
          teams: input.teams,
          packs: packVersions,
          excludedTags: input.excludedTags ?? [...(deps.excludedTags?.() ?? [])],
        },
        { at: at() },
      );
      if (!r.ok) return err(r.error);
      const save: CampaignSave = { id: deps.newId(), name: name.data, campaignId: input.campaign, packVersions, events: [...engine.events], createdAt: at() };
      await repo.put(save);
      engines.set(save.id, { registry: snap.registry, engine });
      return ok(view(save, engine));
    },

    open: (id) => withEngine(id, (save, engine) => ok(view(save, engine))),

    dispatch: (id, command) =>
      withEngine(id, async (save, engine) => {
        const r = engine.dispatch(command, { at: at() });
        if (!r.ok) return err(r.error);
        return ok({ ...view(await persist(save, engine), engine), events: r.events });
      }),

    preview: (id, command) =>
      withEngine(id, (_save, engine) => {
        const r = engine.preview(command);
        return r.ok ? ok({ state: r.state, events: r.events }) : err(r.error);
      }),

    undo: (id) =>
      withEngine(id, async (save, engine) => {
        const last = engine.events.at(-1)?.seq ?? 0;
        if (last <= 1) return err('Nothing to undo: only the campaign start remains');
        engine.undo(last - 1);
        return ok(view(await persist(save, engine), engine));
      }),

    async rename(id, name) {
      const save = await read(id);
      if (!save.ok) return save;
      const n = Name.safeParse(name);
      if (!n.success) return err(`Name: ${zodMessage(n.error)}`);
      const next = { ...save.value, name: n.data };
      await repo.put(next);
      return ok(next);
    },

    async remove(id) {
      engines.delete(id);
      await repo.delete(id);
    },

    async exportSave(id) {
      const save = await read(id);
      if (!save.ok) return save;
      return ok(JSON.stringify({ format: CAMPAIGN_EXPORT_FORMAT, version: 1, save: save.value }, null, 2));
    },

    async importSave(input) {
      const json = parseJson(input);
      if (!json.ok) return json;
      const env = CampaignExport.safeParse(json.value);
      if (!env.success) return err(`Not a campaign save: ${zodMessage(env.error)}`);
      const save = { ...env.data.save, id: (await repo.get(env.data.save.id)) ? deps.newId() : env.data.save.id };
      // Validate payloads/seq before persisting (engine.load is all-or-nothing).
      const probe = createCampaignEngine(deps.content().registry);
      const loaded = probe.load(save.events as CampaignEvent[]);
      if (!loaded.ok) return err(loaded.error);
      if (save.events[0]?.type !== 'CampaignStarted') return err('Campaign save must begin with CampaignStarted');
      await repo.put(save);
      engines.set(save.id, { registry: deps.content().registry, engine: probe });
      return ok(view(save, probe));
    },
  };
}
