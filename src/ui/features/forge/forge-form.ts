import { slugify, type UnitDraft } from '../../../app';
import type { Armor, Id, KeywordRef, UnitCard, UnitType } from '$lib/packs/schema';

// Forge form model ↔ UnitDraft. Form numbers are nullable (empty input); keys are derived from
// names for new items and preserved for existing ones (session events reference unitId + key).

export type Num = number | null | undefined;

export interface WeaponForm {
  key?: string;
  name: string;
  minRange: Num;
  maxRange: Num;
  damage: Num;
  usesMax: Num;
  keywords: KeywordRef[];
  text: string;
}

export interface RuleForm {
  key?: string;
  name: string;
  usesMax: Num;
  text: string;
}

export interface SpecialistForm {
  key?: string;
  name: string;
  skill: Num;
  move: Num;
  armorDice: Num;
  armorTarget: Num;
  weapons: WeaponForm[];
  rules: RuleForm[];
  keywords: KeywordRef[];
}

export interface TrackForm {
  key?: string;
  name: string;
  size: Num;
}

export interface UnitForm {
  name: string;
  code: string;
  faction: string;
  type: UnitType;
  skill: Num;
  move: Num;
  armorDice: Num;
  armorTarget: Num;
  grunts: Num;
  combatLoads: Num;
  modelCount: Num;
  weapons: WeaponForm[];
  specialists: SpecialistForm[];
  rules: RuleForm[];
  keywords: KeywordRef[];
  damageTracks: TrackForm[];
  text: string;
  /** Carried through untouched (no editor yet). */
  behavior: string[];
  tags: string[];
}

export const UNIT_TYPE_OPTIONS: readonly { value: UnitType; label: string }[] = [
  { value: 'infantry', label: 'Infantry' },
  { value: 'handler', label: 'Handler' },
  { value: 'duster', label: 'Duster' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'hostile', label: 'Hostile' },
];

export const blankWeapon = (): WeaponForm => ({ name: '', minRange: null, maxRange: null, damage: null, usesMax: null, keywords: [], text: '' });
export const blankRule = (): RuleForm => ({ name: '', usesMax: null, text: '' });
export const blankTrack = (): TrackForm => ({ name: '', size: 2 });
export const blankSpecialist = (): SpecialistForm => ({ name: '', skill: null, move: null, armorDice: null, armorTarget: null, weapons: [], rules: [], keywords: [] });

/** Sensible starting point for a new unit (BLKOUT infantry baseline). */
export function blankForm(faction = ''): UnitForm {
  return {
    name: '',
    code: '',
    faction,
    type: 'infantry',
    skill: 6,
    move: 6,
    armorDice: 1,
    armorTarget: 6,
    grunts: 2,
    combatLoads: 1,
    modelCount: null,
    weapons: [blankWeapon()],
    specialists: [],
    rules: [],
    keywords: [],
    damageTracks: [],
    text: '',
    behavior: [],
    tags: [],
  };
}

const num = (n: Num): number | undefined => (typeof n === 'number' && Number.isFinite(n) ? n : undefined);

/** Spread helper: `{key: value}` only when value is present (exactOptionalPropertyTypes). */
function opt<K extends string, V>(key: K, value: V | undefined | ''): { [P in K]?: V } {
  return value === undefined || value === '' ? {} : ({ [key]: value } as { [P in K]?: V });
}

/** Stable key: existing, else slug of the name, unique within `taken`. */
function keyFor(item: { key?: string | undefined; name: string }, fallback: string, taken: Set<string>): string {
  let key = item.key ?? (item.name.trim() ? slugify(item.name) : fallback);
  if (!item.key) for (let n = 2, stem = key; taken.has(key); n++) key = `${stem}-${n}`;
  taken.add(key);
  return key;
}

function keyed<T extends { key?: string | undefined; name: string }>(items: readonly T[], fallback: string): (T & { key: string })[] {
  const taken = new Set(items.flatMap((i) => (i.key ? [i.key] : [])));
  return items.map((it, i) => ({ ...it, key: keyFor(it, `${fallback}-${i + 1}`, taken) }));
}

function armorOf(dice: Num, target: Num): Armor | undefined {
  const d = num(dice);
  const t = num(target);
  return d === undefined || t === undefined ? undefined : { dice: d, target: t };
}

function weaponDraft(w: WeaponForm & { key: string }) {
  return {
    key: w.key,
    name: w.name,
    ...opt('minRange', num(w.minRange)),
    ...opt('maxRange', num(w.maxRange)),
    ...opt('damage', num(w.damage)),
    ...opt('usesMax', num(w.usesMax)),
    keywords: w.keywords,
    ...opt('text', w.text.trim()),
  };
}

function ruleDraft(r: RuleForm & { key: string }) {
  return { key: r.key, name: r.name, ...opt('usesMax', num(r.usesMax)), text: r.text };
}

/** Form → service draft. Missing required numbers are left out so the schema reports them on the field. */
export function formToDraft(f: UnitForm): UnitDraft {
  const draft = {
    name: f.name,
    faction: f.faction,
    type: f.type,
    ...opt('code', f.code.trim()),
    ...opt('skill', num(f.skill)),
    ...opt('move', num(f.move)),
    ...opt('armor', armorOf(f.armorDice, f.armorTarget)),
    ...opt('grunts', num(f.grunts)),
    ...opt('modelCount', num(f.modelCount)),
    ...opt('combatLoads', num(f.combatLoads)),
    weapons: keyed(f.weapons, 'weapon').map(weaponDraft),
    specialists: keyed(f.specialists, 'specialist').map((s) => ({
      key: s.key,
      name: s.name,
      ...opt('skill', num(s.skill)),
      ...opt('move', num(s.move)),
      ...opt('armor', armorOf(s.armorDice, s.armorTarget)),
      weapons: keyed(s.weapons, 'weapon').map(weaponDraft),
      rules: keyed(s.rules, 'rule').map(ruleDraft),
      keywords: s.keywords,
    })),
    rules: keyed(f.rules, 'rule').map(ruleDraft),
    keywords: f.keywords,
    ...(f.damageTracks.length ? { damageTracks: keyed(f.damageTracks, 'track').map((t) => ({ key: t.key, name: t.name, ...opt('size', num(t.size)) })) } : {}),
    behavior: f.behavior,
    ...opt('text', f.text.trim()),
    tags: f.tags,
  };
  // Incomplete forms are still validated (the service reports missing fields).
  return draft as UnitDraft;
}

const weaponForm = (w: UnitCard['weapons'][number]): WeaponForm => ({
  key: w.key,
  name: w.name,
  minRange: w.minRange ?? null,
  maxRange: w.maxRange ?? null,
  damage: w.damage ?? null,
  usesMax: w.usesMax ?? null,
  keywords: w.keywords.map((k) => ({ ...k })),
  text: w.text ?? '',
});
const ruleForm = (r: UnitCard['rules'][number]): RuleForm => ({ key: r.key, name: r.name, usesMax: r.usesMax ?? null, text: r.text });

/** Saved unit (qualified ids) → form. */
export function unitToForm(u: UnitCard): UnitForm {
  return {
    name: u.name,
    code: u.code ?? '',
    faction: u.faction,
    type: u.type,
    skill: u.skill,
    move: u.move,
    armorDice: u.armor.dice,
    armorTarget: u.armor.target,
    grunts: u.grunts,
    combatLoads: u.combatLoads,
    modelCount: u.modelCount ?? null,
    weapons: u.weapons.map(weaponForm),
    specialists: u.specialists.map((s) => ({
      key: s.key,
      name: s.name,
      skill: s.skill ?? null,
      move: s.move ?? null,
      armorDice: s.armor?.dice ?? null,
      armorTarget: s.armor?.target ?? null,
      weapons: s.weapons.map(weaponForm),
      rules: s.rules.map(ruleForm),
      keywords: s.keywords.map((k) => ({ ...k })),
    })),
    rules: u.rules.map(ruleForm),
    keywords: u.keywords.map((k) => ({ ...k })),
    damageTracks: (u.damageTracks ?? []).map((t) => ({ key: t.key, name: t.name, size: t.size })),
    text: u.text ?? '',
    behavior: [...u.behavior],
    tags: [...u.tags],
  };
}

/** Best-effort UnitCard for the live preview (missing numbers shown as 0, blank names as placeholders). */
export function previewUnit(f: UnitForm): UnitCard {
  const z = (n: Num) => num(n) ?? 0;
  const weapon = (w: WeaponForm & { key: string }) => ({ ...weaponDraft(w), name: w.name || 'Unnamed weapon' });
  const rule = (r: RuleForm & { key: string }) => ({ ...ruleDraft(r), name: r.name || 'Unnamed rule' });
  return {
    id: 'user:preview' as Id,
    name: f.name || 'Unnamed unit',
    faction: f.faction || 'user:unassigned',
    type: f.type,
    skill: z(f.skill),
    move: z(f.move),
    armor: { dice: z(f.armorDice), target: z(f.armorTarget) },
    grunts: z(f.grunts),
    combatLoads: z(f.combatLoads),
    weapons: keyed(f.weapons, 'weapon').map(weapon),
    specialists: keyed(f.specialists, 'specialist').map((s) => ({
      key: s.key,
      name: s.name || 'Unnamed specialist',
      ...opt('skill', num(s.skill)),
      ...opt('move', num(s.move)),
      ...opt('armor', armorOf(s.armorDice, s.armorTarget)),
      weapons: keyed(s.weapons, 'weapon').map(weapon),
      rules: keyed(s.rules, 'rule').map(rule),
      keywords: s.keywords,
    })),
    rules: keyed(f.rules, 'rule').map(rule),
    keywords: f.keywords,
    damageTracks: keyed(f.damageTracks, 'track').map((t) => ({ key: t.key, name: t.name || 'Track', size: Math.max(1, Math.min(12, z(t.size))) })),
    behavior: [],
    source: { custom: true },
    tags: [],
  };
}

/** Local id (`user:slug` → `slug`) for routing. */
export const localId = (id: string): string => id.slice(id.indexOf(':') + 1);
