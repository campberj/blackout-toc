import type { LibraryError, LibrarySnapshot, PackInfo } from '../../../app';
import type { ForceCard, Id, UnitCard, UnitType } from '$lib/packs/schema';

// Pure view logic for the Library page (filters, recovery targets, glossary).

type Lookup = LibrarySnapshot['registry'];

/**
 * Enabled packs to offer for one-tap disable when the enabled set fails to load:
 * packs named by the errors (or with their own shape errors), else every enabled pack.
 */
export function failingPacks(errors: readonly LibraryError[], packs: readonly PackInfo[]): PackInfo[] {
  const enabled = packs.filter((p) => p.enabled);
  const named = new Set(errors.flatMap((e) => (e.packId === undefined ? [] : [e.packId])));
  const hit = enabled.filter((p) => named.has(p.id) || p.errors.length > 0);
  return hit.length > 0 ? hit : enabled;
}

export interface CardFilter {
  query: string;
  factions: readonly string[];
  types: readonly string[];
}

export const emptyFilter = (): CardFilter => ({ query: '', factions: [], types: [] });

const norm = (s: string) => s.trim().toLowerCase();

function matchesQuery(q: string, ...fields: (string | undefined)[]): boolean {
  const n = norm(q);
  return !n || fields.some((f) => f !== undefined && f.toLowerCase().includes(n));
}

export function filterUnits(units: readonly UnitCard[], f: CardFilter): UnitCard[] {
  return units.filter(
    (u) =>
      (f.factions.length === 0 || f.factions.includes(u.faction)) &&
      (f.types.length === 0 || f.types.includes(u.type)) &&
      matchesQuery(f.query, u.name, u.code, u.id, ...u.weapons.map((w) => w.name)),
  );
}

/** Forces have no unit type: a type filter hides them unless it is empty. */
export function filterForces(forces: readonly ForceCard[], f: CardFilter): ForceCard[] {
  if (f.types.length > 0) return [];
  return forces.filter((x) => (f.factions.length === 0 || f.factions.includes(x.faction)) && matchesQuery(f.query, x.name, x.id));
}

export interface FactionGroup<T> {
  faction: string;
  name: string;
  items: T[];
}

/** Group by faction id, sorted by faction display name then item name. */
export function groupByFaction<T extends { faction: string; name: string }>(items: readonly T[], lookup: Lookup): FactionGroup<T>[] {
  const by = new Map<string, T[]>();
  for (const it of items) by.set(it.faction, [...(by.get(it.faction) ?? []), it]);
  return [...by]
    .map(([faction, xs]) => ({
      faction,
      name: lookup.get('faction', faction as Id)?.name ?? faction,
      items: [...xs].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Factions that have at least one unit or force (filter chip options). */
export function factionOptions(lookup: Lookup): { value: string; label: string }[] {
  const used = new Set([...lookup.list('unit'), ...lookup.list('force')].map((x) => x.faction));
  return [...used]
    .map((id) => ({ value: id, label: lookup.get('faction', id as Id)?.name ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const TYPE_LABELS: Record<UnitType, string> = { infantry: 'Infantry', handler: 'Handler', duster: 'Duster', vehicle: 'Vehicle', hostile: 'Hostile' };

export function typeOptions(units: readonly UnitCard[]): { value: string; label: string }[] {
  const used = new Set(units.map((u) => u.type));
  return (Object.keys(TYPE_LABELS) as UnitType[]).filter((t) => used.has(t)).map((t) => ({ value: t, label: TYPE_LABELS[t] }));
}

export interface GlossaryRow {
  id: string;
  name: string;
  appliesTo: string;
  param: boolean;
  text: string;
  /** True when the active ruleset has its own text (not the gist fallback). */
  rulesetText: boolean;
}

/** Every loaded keyword with the active ruleset's text, sorted, optionally filtered. */
export function glossary(lookup: Lookup, rulesetId: Id | undefined, query = ''): GlossaryRow[] {
  return lookup
    .list('keyword')
    .filter((k) => matchesQuery(query, k.name, k.gist))
    .map((k) => ({
      id: k.id,
      name: k.name,
      appliesTo: k.appliesTo,
      param: k.param === 'X',
      text: lookup.keywordText(k.id as Id, rulesetId) ?? k.gist,
      rulesetText: rulesetId !== undefined && k.byRuleset?.[rulesetId] !== undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
