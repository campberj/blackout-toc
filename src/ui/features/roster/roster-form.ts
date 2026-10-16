import type { LibrarySnapshot, Roster, RosterInput } from '../../../app';
import type { Count, Id, RosterMode, RosterModeKey, UnitCard } from '$lib/packs/schema';

// Pure roster-builder logic: blank drafts, option lists, mode summaries, input cleaning.

type Lookup = LibrarySnapshot['registry'];
export type RosterGroupDraft = Roster['groups'][number];

/** Placeholder id so unsaved drafts pass the schema in live validation. */
export const DRAFT_ID = 'draft';
export const ALL_MODES: readonly RosterModeKey[] = ['core', 'matched', 'skirmish'];

export const emptyGroup = (): RosterGroupDraft => ({ unitIds: [] });

export function modesFor(lookup: Lookup, rulesetId: string): RosterMode[] {
  return [...(lookup.get('ruleset', rulesetId as Id)?.rosterModes ?? [])];
}

export function modeOf(lookup: Lookup, r: Pick<Roster, 'rulesetId' | 'mode'>): RosterMode | undefined {
  return modesFor(lookup, r.rulesetId).find((m) => m.mode === r.mode);
}

export function blankRoster(lookup: Lookup, rulesetId: Id): Roster {
  const mode = modesFor(lookup, rulesetId)[0];
  const groups = Math.max(1, mode?.groups.min ?? 1);
  return {
    id: DRAFT_ID,
    name: 'New team',
    rulesetId,
    mode: mode?.mode ?? 'core',
    groups: Array.from({ length: groups }, emptyGroup),
    notes: '',
  };
}

export type HandlerRule = 'required' | 'optional' | 'forbidden';

export function handlerRule(mode: RosterMode | undefined): HandlerRule {
  const c = mode?.handlersPerGroup;
  if (c?.max === 0) return 'forbidden';
  return (c?.min ?? 0) >= 1 ? 'required' : 'optional';
}

function count(c: Count, noun: string, plural = `${noun}s`): string {
  const { min, max } = c;
  const n = (x: number) => `${x} ${x === 1 ? noun : plural}`;
  if (min !== undefined && max !== undefined) return min === max ? n(min) : `${min}–${max} ${plural}`;
  if (min !== undefined) return `${min}+ ${plural}`;
  if (max !== undefined) return `up to ${n(max)}`;
  return `any ${plural}`;
}

/** One-line composition rule for the selected mode. */
export function modeSummary(mode: RosterMode): string {
  const parts = [
    count(mode.groups, 'group'),
    `${count(mode.forceCardsPerGroup, 'force card')} per group`,
    `${count(mode.unitsPerGroup, 'unit')}${mode.distinctUnitsPerGroup ? ' (all different)' : ''} per group`,
    { required: 'handler required', optional: 'handler optional', forbidden: 'no handlers' }[handlerRule(mode)],
    mode.dusters.max > 0 ? `up to ${mode.dusters.max} duster${mode.dusters.max === 1 ? '' : 's'}` : '',
  ];
  return parts.filter(Boolean).join(', ');
}

export interface UnitOptions {
  forces: { id: string; name: string; faction: string }[];
  handlers: UnitCard[];
  dusters: UnitCard[];
  /** Group members: everything except handlers/dusters, narrowed by the mode's allowed types. */
  units: UnitCard[];
}

const byName = <T extends { name: string }>(xs: readonly T[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));

export function unitOptions(lookup: Lookup, mode: RosterMode | undefined): UnitOptions {
  const all = lookup.list('unit');
  const allowed = mode?.allowedUnitTypes;
  return {
    forces: byName(lookup.list('force')).map((f) => ({ id: f.id, name: f.name, faction: f.faction })),
    handlers: byName(all.filter((u) => u.type === 'handler')),
    dusters: byName(all.filter((u) => u.type === 'duster')),
    units: byName(all.filter((u) => u.type !== 'handler' && u.type !== 'duster' && (!allowed || allowed.includes(u.type)))),
  };
}

/** Group options by faction display name (for <optgroup>), the group's own faction first. */
export function byFaction<T extends { faction: string }>(lookup: Lookup, items: readonly T[], first?: string): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of items) groups.set(it.faction, [...(groups.get(it.faction) ?? []), it]);
  return [...groups]
    .sort(([a], [b]) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)))
    .map(([f, xs]) => ({ label: lookup.get('faction', f as Id)?.name ?? f, items: xs }));
}

/** "Alpha (copy)", then "Alpha (copy 2)" … unique among `taken`. */
export function copyName(name: string, taken: readonly string[]): string {
  const stem = name.replace(/ \(copy(?: \d+)?\)$/, '');
  const set = new Set(taken);
  let candidate = `${stem} (copy)`;
  for (let n = 2; set.has(candidate); n++) candidate = `${stem} (copy ${n})`;
  return candidate.slice(0, 80);
}

/** Set or clear an optional id without leaving `undefined` keys (exactOptionalPropertyTypes). */
export function withOptional<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | '' | undefined): T {
  const next = { ...obj };
  if (value === '' || value === undefined) delete next[key];
  else next[key] = value as T[K];
  return next;
}

/** Service input for create: everything but the placeholder id. */
export function toNewInput(r: Roster): Omit<RosterInput, 'id'> {
  const { id: _id, ...rest } = r;
  void _id;
  return rest;
}

export const unitCount = (r: Roster): number => r.groups.reduce((n, g) => n + g.unitIds.length + (g.handlerId ? 1 : 0), r.dusterId ? 1 : 0);
