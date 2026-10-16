import { z } from 'zod';
import { StoredEvent } from './stored-event';
import {
  createGameEngine,
  CustomContact,
  gameLog,
  SessionLink,
  setupFromLaunch,
  setupFromRoster,
  templateFromCard,
  templateFromContact,
  toAarPrefill,
  type BuiltSetup,
  type GameCommandInput,
  type GameEngine,
  type GameEvent,
  type GameIssue,
  type GameRejection,
  type GameState,
  type LogEntry,
  type Side,
} from '../domain/game';
import { Roster } from '../domain/roster';
import { err, ok, type Result } from '../domain/result';
import { Name, type Id } from '../packs/schema';
import { COLLECTIONS, type Clock, type Repository, type Storage } from '../ports';
import type { AarPrefill, GameCampaignBridge, GameLaunchRequest } from './contracts/game-campaign';
import type { LibrarySnapshot } from './pack-library';
import type { IdSource } from './ports';

// Game sessions (F3): event log + metadata in `sessions`, write-through on every accepted command.
// Also the campaign bridge (D18): launch → linked session; ended linked session → AAR pre-fill.


export const SessionRecord = z.object({
  id: z.string().min(1).max(64),
  name: Name,
  createdAt: z.string(),
  /** Present while the campaign still expects this session's result; cleared by `consume`. */
  link: SessionLink.optional(),
  events: z.array(StoredEvent),
});
export type SessionRecord = z.infer<typeof SessionRecord>;

export interface OpenSession {
  readonly record: SessionRecord;
  readonly state: GameState;
  readonly log: readonly LogEntry[];
}

export interface SessionSummary {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly link?: SessionLink;
  readonly scenarioName: string | null;
  readonly round: number;
  readonly roundLimit: number;
  readonly ended: boolean;
  readonly lastAt: string | null;
}

export interface NewSessionInput {
  readonly rosterId: string;
  readonly scenarioId?: Id | undefined;
  readonly name?: string | undefined;
}

export type Accepted = OpenSession & { readonly warnings: readonly GameIssue[] };

export interface SessionService extends GameCampaignBridge {
  list(): Promise<SessionSummary[]>;
  /** Unlinked game from a saved roster (+ optional scenario). `missing` = card ids not loaded (skipped). */
  create(input: NewSessionInput): Promise<Result<OpenSession & { missing: readonly string[] }, string>>;
  open(id: string): Promise<Result<OpenSession, string>>;
  dispatch(id: string, command: GameCommandInput): Promise<Result<Accepted, GameRejection>>;
  /** Quick-add copies of a loaded unit card to a side. */
  quickAdd(id: string, side: Side, unitId: Id, count?: number): Promise<Result<Accepted, GameRejection>>;
  /** Generic custom contact (name, model count, optional damage track). */
  addContact(id: string, side: Side, contact: CustomContact): Promise<Result<Accepted, GameRejection>>;
  /** Undo the last command. Refuses to remove the start (delete the session instead). */
  undo(id: string): Promise<Result<OpenSession, string>>;
  /** End the game (ending before the round limit only warns). Linked sessions return the AAR pre-fill. */
  end(id: string): Promise<Result<Accepted & { prefill?: AarPrefill }, GameRejection>>;
  rename(id: string, name: string): Promise<Result<SessionRecord, string>>;
  remove(id: string): Promise<void>;
}

export interface SessionServiceDeps {
  readonly storage: Storage;
  readonly content: () => LibrarySnapshot;
  readonly activeRulesetId: () => Id | undefined;
  readonly clock: Clock;
  readonly newId: IdSource;
}

const zodMessage = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
const reject = (message: string): GameRejection => ({ message, issues: [], overridable: false });
const sameLink = (l: SessionLink | undefined, save: string, mission: string) => l?.campaignSaveId === save && l.mission === mission;

export function createSessionService(deps: SessionServiceDeps): SessionService {
  const repo = deps.storage.collection(COLLECTIONS.sessions) as unknown as Repository<SessionRecord>;
  const rosters = deps.storage.collection(COLLECTIONS.rosters);
  // Engines are content-free, so the cache never goes stale except via storage writes we make.
  const engines = new Map<string, GameEngine>();
  const at = () => deps.clock.now().toISOString();

  async function records(): Promise<SessionRecord[]> {
    return (await repo.list()).flatMap((x) => {
      const r = SessionRecord.safeParse(x);
      return r.success ? [r.data] : [];
    });
  }

  async function read(id: string): Promise<Result<{ record: SessionRecord; engine: GameEngine }, string>> {
    const raw = await repo.get(id);
    if (!raw) return err(`Game "${id}" not found`);
    const r = SessionRecord.safeParse(raw);
    if (!r.success) return err(`Game "${id}" is corrupt: ${zodMessage(r.error)}`);
    const hit = engines.get(id);
    if (hit) return ok({ record: r.data, engine: hit });
    const engine = createGameEngine();
    const loaded = engine.load(r.data.events as GameEvent[]);
    if (!loaded.ok) return err(`Game "${id}" is corrupt: ${loaded.error}`);
    engines.set(id, engine);
    return ok({ record: r.data, engine });
  }

  const view = (record: SessionRecord, engine: GameEngine): OpenSession => ({ record, state: engine.state, log: gameLog(engine.events, engine.state) });

  async function persist(record: SessionRecord, engine: GameEngine): Promise<SessionRecord> {
    const next = { ...record, events: [...engine.events] };
    try {
      await repo.put(next);
    } catch (e) {
      engines.delete(record.id); // engine is ahead of storage; reload next time
      throw e;
    }
    return next;
  }

  async function createFrom(built: BuiltSetup, link?: SessionLink): Promise<Result<OpenSession, string>> {
    const name = Name.safeParse(built.setup.name);
    if (!name.success) return err(`Name: ${zodMessage(name.error)}`);
    const engine = createGameEngine();
    const r = engine.start(built.setup, { at: at() });
    if (!r.ok) return err(r.error.message);
    const record: SessionRecord = { id: deps.newId(), name: name.data, createdAt: at(), ...(link ? { link } : {}), events: [...engine.events] };
    await repo.put(record);
    engines.set(record.id, engine);
    return ok(view(record, engine));
  }

  async function dispatch(id: string, command: GameCommandInput): Promise<Result<Accepted, GameRejection>> {
    const s = await read(id);
    if (!s.ok) return err(reject(s.error));
    const { record, engine } = s.value;
    const r = engine.dispatch(command, { at: at() });
    if (!r.ok) return r;
    return ok({ ...view(await persist(record, engine), engine), warnings: r.value.warnings });
  }

  /** Ended linked sessions for a mission, newest first. */
  async function endedLinked(save: string, mission: string) {
    const out: { record: SessionRecord; engine: GameEngine }[] = [];
    for (const rec of await records()) {
      if (!sameLink(rec.link, save, mission)) continue;
      const s = await read(rec.id);
      if (s.ok && s.value.engine.state.ended) out.push(s.value);
    }
    return out.sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt));
  }

  return {
    async list() {
      const out: SessionSummary[] = [];
      for (const rec of await records()) {
        const s = await read(rec.id);
        if (!s.ok) continue;
        const st = s.value.engine.state;
        out.push({
          id: rec.id,
          name: rec.name,
          createdAt: rec.createdAt,
          ...(rec.link ? { link: rec.link } : {}),
          scenarioName: st.scenarioName,
          round: st.round,
          roundLimit: st.roundLimit,
          ended: st.ended,
          lastAt: rec.events.at(-1)?.at ?? null,
        });
      }
      return out.sort((a, b) => (b.lastAt ?? b.createdAt).localeCompare(a.lastAt ?? a.createdAt));
    },

    async create(input) {
      const roster = Roster.safeParse(await rosters.get(input.rosterId));
      if (!roster.success) return err(`Roster "${input.rosterId}" not found`);
      const built = setupFromRoster({ roster: roster.data, lookup: deps.content().registry, scenarioId: input.scenarioId, name: input.name });
      if (!built.ok) return built;
      const r = await createFrom(built.value);
      return r.ok ? ok({ ...r.value, missing: built.value.missing }) : r;
    },

    async open(id) {
      const s = await read(id);
      return s.ok ? ok(view(s.value.record, s.value.engine)) : s;
    },

    dispatch,

    quickAdd(id, side, unitId, count = 1) {
      const card = deps.content().registry.get('unit', unitId);
      if (!card) return Promise.resolve(err(reject(`Unit "${unitId}" is not loaded`)));
      const n = Math.max(1, Math.min(20, Math.floor(count)));
      const run = async (i: number, last?: Accepted): Promise<Result<Accepted, GameRejection>> => {
        if (i > n) return ok(last!);
        const r = await dispatch(id, { type: 'addUnit', side, unit: templateFromCard(card, n > 1 ? { name: `${card.name} ${i}` } : {}) });
        return r.ok ? run(i + 1, r.value) : r;
      };
      return run(1);
    },

    addContact(id, side, contact) {
      const c = CustomContact.safeParse(contact);
      if (!c.success) return Promise.resolve(err(reject(zodMessage(c.error))));
      return dispatch(id, { type: 'addUnit', side, unit: templateFromContact(c.data) });
    },

    async undo(id) {
      const s = await read(id);
      if (!s.ok) return s;
      const { record, engine } = s.value;
      if (!engine.undo()) return err('Nothing to undo: only the game start remains');
      return ok(view(await persist(record, engine), engine));
    },

    async end(id) {
      const r = await dispatch(id, { type: 'endGame' });
      if (!r.ok) return r;
      const prefill = toAarPrefill(r.value.state);
      return ok({ ...r.value, ...(prefill ? { prefill } : {}) });
    },

    async rename(id, name) {
      const s = await read(id);
      if (!s.ok) return s;
      const n = Name.safeParse(name);
      if (!n.success) return err(`Name: ${zodMessage(n.error)}`);
      const next = { ...s.value.record, name: n.data };
      await repo.put(next);
      return ok(next);
    },

    async remove(id) {
      engines.delete(id);
      await repo.delete(id);
    },

    // ── GameCampaignBridge ──
    async launch(req: GameLaunchRequest) {
      const link = { campaignSaveId: req.campaignSaveId, mission: req.mission };
      // Relaunching an unfinished mission resumes its board instead of duplicating it.
      for (const rec of await records()) {
        if (!sameLink(rec.link, req.campaignSaveId, req.mission)) continue;
        const s = await read(rec.id);
        if (s.ok && !s.value.engine.state.ended) return rec.id;
      }
      const built = setupFromLaunch({ req, lookup: deps.content().registry, rulesetId: deps.activeRulesetId() });
      if (!built.ok) throw new Error(built.error);
      const r = await createFrom(built.value, link);
      if (!r.ok) throw new Error(r.error);
      return r.value.record.id;
    },

    async prefillFor(save, mission) {
      const [latest] = await endedLinked(save, mission);
      return latest ? toAarPrefill(latest.engine.state) : undefined;
    },

    async consume(save, mission) {
      for (const { record } of await endedLinked(save, mission)) {
        const { link: _link, ...rest } = record; // eslint-disable-line @typescript-eslint/no-unused-vars
        await repo.put(rest);
      }
    },
  };
}
