import type { z } from 'zod';
import { applicableCalibrations, dotted, hasErrors, issue, validateUnit, type ValidationIssue } from '../domain/rules';
import { err, ok, type Result } from '../domain/result';
import { collectRefs, namespacePack, parsePack, parseVersion } from '../packs/loader';
import { PACK_FORMAT, PACK_FORMAT_VERSION, UnitCard, type Id, type Pack, type PackInput } from '../packs/schema';
import { formatLoadError, type LibraryError } from './errors';
import { USER_PACK_ID, type PackLibrary } from './pack-library';
import { isCustom } from './card-mapper';

// Forge output lives in one editable pack `user` (DESIGN §7), persisted through the PackLibrary
// so it is validated, namespaced and loaded like any other pack.

type UnitCardInput = z.input<typeof UnitCard>;
/** Forge form value; `id` (local slug, or `user:slug`) is generated from the name when absent. */
export type UnitDraft = Omit<UnitCardInput, 'id'> & { id?: string };

export interface SavedUnit {
  /** As loaded (qualified ids). */
  readonly unit: UnitCard;
  readonly warnings: readonly ValidationIssue[];
}

export interface CustomUnitService {
  /** Units in the user pack, as loaded (qualified ids). Empty if the user pack is disabled/failed. */
  list(): UnitCard[];
  /** Errors + warnings for a draft without saving (live Forge feedback). `editing` = local id being updated. */
  validate(draft: UnitDraft, editing?: string): ValidationIssue[];
  create(draft: UnitDraft): Promise<Result<SavedUnit, ValidationIssue[]>>;
  update(id: string, draft: UnitDraft): Promise<Result<SavedUnit, ValidationIssue[]>>;
  remove(id: string): Promise<Result<void, ValidationIssue[]>>;
  /** User pack JSON for sharing/backup. */
  exportPack(): Promise<string>;
}

export interface CustomUnitServiceDeps {
  readonly library: PackLibrary;
  readonly activeRulesetId: () => Id | undefined;
}

const localOf = (id: string) => (id.startsWith(`${USER_PACK_ID}:`) ? id.slice(USER_PACK_ID.length + 1) : id);

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'unit'
  );
}

const emptyUserPack = (): PackInput => ({
  format: PACK_FORMAT,
  formatVersion: PACK_FORMAT_VERSION,
  id: USER_PACK_ID,
  version: '1.0.0',
  title: 'My Units',
  author: 'Unit Forge',
  requires: [],
  content: {},
});

function bump(version: string): string {
  const v = parseVersion(version);
  return v ? `${v.major}.${v.minor}.${v.patch + 1}` : '1.0.0';
}

const UNIT_PREFIX = /^\/content\/units\/(\d+)(\/.*)?$/;
const unesc = (s: string) => s.replace(/~1/g, '/').replace(/~0/g, '~');

/** Loader error → issue; errors inside the edited unit get unit-relative dotted paths. */
function fromLoadError(e: LibraryError, unitIndex: number): ValidationIssue {
  const m = UNIT_PREFIX.exec(e.path);
  if (e.packId === USER_PACK_ID && m && Number(m[1]) === unitIndex)
    return issue('error', (m[2] ?? '').split('/').slice(1).map(unesc).join('.'), e.code, e.message);
  return issue('error', '', e.code, formatLoadError(e));
}

export function createCustomUnitService(deps: CustomUnitServiceDeps): CustomUnitService {
  const { library } = deps;

  const sourcePack = async (): Promise<PackInput> => {
    const raw = await library.raw(USER_PACK_ID);
    return raw ? (structuredClone(raw) as PackInput) : emptyUserPack();
  };

  interface Candidate {
    raw: PackInput;
    index: number;
    /** Namespaced unit when the draft parsed. */
    unit?: UnitCard;
    issues: ValidationIssue[];
  }

  /** Build the next user pack with `draft` at local id `id`, and validate it (no I/O). */
  function candidate(base: PackInput, id: string, draft: UnitDraft): Candidate {
    const units = [...(base.content?.units ?? [])];
    const at = units.findIndex((u) => u.id === id);
    const index = at >= 0 ? at : units.length;
    const input = { ...draft, id, source: { ...draft.source, custom: true } } as UnitCardInput;
    units[index] = input;
    const raw: PackInput = { ...base, content: { ...base.content, units } };
    const parsed = UnitCard.safeParse(input);
    if (!parsed.success) return { raw, index, issues: parsed.error.issues.map((i) => issue('error', dotted(i.path), 'schema', i.message)) };

    const pack = parsePack(raw);
    if (!pack.ok) return { raw, index, issues: pack.error.map((e) => fromLoadError(e, index)) };
    raw.requires = requiresOf(pack.value, base);
    const unit = namespacePack(pack.value).content.units[index]!;

    const { registry } = library.snapshot;
    const rulesetId = deps.activeRulesetId();
    const ruleset = rulesetId === undefined ? undefined : registry.get('ruleset', rulesetId);
    const issues = validateUnit(unit, {
      lookup: registry,
      ...(ruleset ? { ruleset } : {}),
      calibrations: applicableCalibrations(registry.list('calibration'), rulesetId),
      population: registry.list('unit').filter((u) => !isCustom(u)),
    });
    return { raw, index, unit, issues };
  }

  /** Dependencies = packs referenced by qualified refs; existing ranges are kept, new ones accept any version. */
  function requiresOf(pack: Pack, base: PackInput) {
    const ids = new Set(collectRefs(pack).map((r) => r.ref.slice(0, r.ref.indexOf(':'))));
    ids.delete(USER_PACK_ID);
    const prev = new Map((base.requires ?? []).map((r) => [r.id, r.range]));
    return [...ids].sort().map((id) => ({ id, range: prev.get(id) ?? '*' }));
  }

  async function commit(c: Candidate, id: string): Promise<Result<SavedUnit, ValidationIssue[]>> {
    if (!c.unit || hasErrors(c.issues)) return err(c.issues);
    const r = await library.import({ ...c.raw, version: bump(c.raw.version) });
    if (!r.ok) return err(r.error.map((e) => fromLoadError(e, c.index)));
    // A disabled user pack is saved but not loaded: fall back to the validated shape.
    return ok({ unit: r.value.snapshot.registry.get('unit', `${USER_PACK_ID}:${id}`) ?? c.unit, warnings: c.issues });
  }

  function freeId(draft: UnitDraft, base: PackInput): string {
    const taken = new Set((base.content?.units ?? []).map((u) => u.id));
    const stem = slugify(draft.name);
    let id = stem;
    for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
    return id;
  }

  return {
    list: () => library.snapshot.registry.list('unit').filter((u) => u.id.startsWith(`${USER_PACK_ID}:`)),

    validate(draft, editing) {
      // Sync, so the unit is checked on its own (id clashes are reported by create).
      const id = localOf(editing ?? draft.id ?? slugify(draft.name ?? ''));
      return candidate(emptyUserPack(), id, draft).issues;
    },

    async create(draft) {
      const base = await sourcePack();
      if (draft.id && (base.content?.units ?? []).some((u) => u.id === localOf(draft.id!)))
        return err([issue('error', 'id', 'duplicate_id', `A custom unit with id "${localOf(draft.id)}" already exists`)]);
      const id = draft.id ? localOf(draft.id) : freeId(draft, base);
      return commit(candidate(base, id, draft), id);
    },

    async update(rawId, draft) {
      const id = localOf(rawId);
      const base = await sourcePack();
      if (!(base.content?.units ?? []).some((u) => u.id === id)) return err([issue('error', 'id', 'not_found', `Custom unit "${id}" not found`)]);
      return commit(candidate(base, id, draft), id);
    },

    async remove(rawId) {
      const id = localOf(rawId);
      const base = await sourcePack();
      const units = (base.content?.units ?? []).filter((u) => u.id !== id);
      if (units.length === (base.content?.units ?? []).length) return err([issue('error', 'id', 'not_found', `Custom unit "${id}" not found`)]);
      const raw: PackInput = { ...base, version: bump(base.version), content: { ...base.content, units } };
      const parsed = parsePack(raw);
      if (parsed.ok) raw.requires = requiresOf(parsed.value, base);
      const r = await library.import(raw);
      return r.ok ? ok(undefined) : err(r.error.map((e) => fromLoadError(e, -1)));
    },

    async exportPack() {
      return JSON.stringify(await sourcePack(), null, 2);
    },
  };
}
