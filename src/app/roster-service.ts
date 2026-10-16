import type { z } from 'zod';
import { Roster, validateRoster, type RosterInput } from '../domain/roster';
import { dotted, issue, type ValidationIssue } from '../domain/rules';
import { err, ok, type Result } from '../domain/result';
import type { ForceCard, Id, UnitCard } from '../packs/schema';
import { COLLECTIONS, type Repository, type Storage } from '../ports';
import type { CardViewModel } from './view-models/card-view-model';
import type { ForceCardViewModel } from './view-models/force-card-view-model';
import { toCardViewModel, toForceCardViewModel, type CardContext } from './card-mapper';
import type { LibrarySnapshot } from './pack-library';
import type { IdSource } from './ports';

export { Roster, type RosterInput };

export const ROSTER_EXPORT_FORMAT = 'blkout-roster';

export interface SavedRoster {
  readonly roster: Roster;
  /** Rules issues; saving is allowed while drafting, so these never block. */
  readonly issues: readonly ValidationIssue[];
}

export interface RosterPrintModel {
  readonly name: string;
  readonly ruleset: string;
  readonly mode: string;
  readonly notes: string;
  readonly duster?: CardViewModel;
  /** One handler per group (RJ ruling). */
  readonly groups: readonly { force?: ForceCardViewModel; handler?: CardViewModel; units: CardViewModel[] }[];
  /** Ids that are not loaded (shown as placeholders). */
  readonly missing: readonly string[];
  readonly issues: readonly ValidationIssue[];
}

/** New roster: everything but `id` (assigned) and rulesetId (defaults to the active ruleset). */
export type NewRosterInput = Omit<RosterInput, 'id' | 'rulesetId'> & { rulesetId?: Id };

export interface RosterService {
  list(): Promise<Roster[]>;
  get(id: string): Promise<Roster | undefined>;
  /** Shape errors block (`severity: 'error'`, code `schema`); rules issues are returned with the saved roster. */
  create(input: NewRosterInput): Promise<Result<SavedRoster, ValidationIssue[]>>;
  update(roster: RosterInput): Promise<Result<SavedRoster, ValidationIssue[]>>;
  remove(id: string): Promise<void>;
  /** Schema + rules issues for any candidate value (live form feedback). */
  validate(roster: unknown): ValidationIssue[];
  printModel(roster: Roster): RosterPrintModel;
  exportRoster(id: string): Promise<Result<string, string>>;
  /** Accepts the export envelope (or a bare roster); always assigned a fresh id. */
  importRoster(input: unknown): Promise<Result<SavedRoster, ValidationIssue[]>>;
}

export interface RosterServiceDeps {
  readonly storage: Storage;
  readonly content: () => LibrarySnapshot;
  readonly activeRulesetId: () => Id | undefined;
  readonly newId: IdSource;
}

const schemaIssues = (e: z.ZodError): ValidationIssue[] => e.issues.map((i) => issue('error', dotted(i.path), 'schema', i.message));

export function createRosterService(deps: RosterServiceDeps): RosterService {
  const repo = deps.storage.collection(COLLECTIONS.rosters) as unknown as Repository<Roster>;
  const lookup = () => deps.content().registry;

  function parse(input: unknown): Result<Roster, ValidationIssue[]> {
    const r = Roster.safeParse(input);
    return r.success ? ok(r.data) : err(schemaIssues(r.error));
  }

  async function save(input: unknown): Promise<Result<SavedRoster, ValidationIssue[]>> {
    const r = parse(input);
    if (!r.ok) return r;
    await repo.put(r.value);
    return ok({ roster: r.value, issues: validateRoster(r.value, lookup()) });
  }

  return {
    async list() {
      return (await repo.list()).flatMap((x) => {
        const r = Roster.safeParse(x);
        return r.success ? [r.data] : [];
      });
    },

    async get(id) {
      const r = Roster.safeParse(await repo.get(id));
      return r.success ? r.data : undefined;
    },

    create(input) {
      const rulesetId = input.rulesetId ?? deps.activeRulesetId();
      if (!rulesetId) return Promise.resolve(err([issue('error', 'rulesetId', 'unresolved', 'No ruleset is loaded; enable a pack that provides one')]));
      return save({ ...input, rulesetId, id: deps.newId() });
    },

    update: (roster) => save(roster),

    remove: (id) => repo.delete(id),

    validate(input) {
      const r = parse(input);
      return r.ok ? validateRoster(r.value, lookup()) : r.error;
    },

    printModel(roster) {
      const reg = lookup();
      const ctx: CardContext = { lookup: reg, rulesetId: roster.rulesetId };
      const missing: string[] = [];
      const unit = (id: Id): CardViewModel | undefined => {
        const u: UnitCard | undefined = reg.get('unit', id);
        if (!u) missing.push(id);
        return u && toCardViewModel(u, ctx);
      };
      const force = (id: Id): ForceCardViewModel | undefined => {
        const f: ForceCard | undefined = reg.get('force', id);
        if (!f) missing.push(id);
        return f && toForceCardViewModel(f, ctx);
      };
      const ruleset = reg.get('ruleset', roster.rulesetId);
      const duster = roster.dusterId && unit(roster.dusterId);
      const groups = roster.groups.map((g) => {
        const f = g.forceCardId && force(g.forceCardId);
        const h = g.handlerId && unit(g.handlerId);
        return { ...(f ? { force: f } : {}), ...(h ? { handler: h } : {}), units: g.unitIds.flatMap((id) => unit(id) ?? []) };
      });
      return {
        name: roster.name,
        ruleset: ruleset?.name ?? roster.rulesetId,
        mode: ruleset?.rosterModes.find((m) => m.mode === roster.mode)?.name ?? roster.mode,
        notes: roster.notes,
        ...(duster ? { duster } : {}),
        groups,
        missing,
        issues: validateRoster(roster, reg),
      };
    },

    async exportRoster(id) {
      const r = Roster.safeParse(await repo.get(id));
      if (!r.success) return err(`Roster "${id}" not found`);
      return ok(JSON.stringify({ format: ROSTER_EXPORT_FORMAT, version: 1, roster: r.data }, null, 2));
    },

    async importRoster(input) {
      let data = input;
      if (typeof input === 'string') {
        try {
          data = JSON.parse(input);
        } catch (e) {
          return err([issue('error', '', 'json_syntax', `Invalid JSON: ${(e as Error).message}`)]);
        }
      }
      const env = data as { format?: unknown; roster?: unknown } | null;
      const roster = env && typeof env === 'object' && env.format === ROSTER_EXPORT_FORMAT ? env.roster : data;
      if (!roster || typeof roster !== 'object') return err([issue('error', '', 'schema', 'Not a roster')]);
      return save({ ...roster, id: deps.newId() });
    },
  };
}

