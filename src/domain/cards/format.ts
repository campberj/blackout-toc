import { Armor as ArmorSchema } from '../../packs/schema/common';
import type { Armor, KeywordRef } from '../../packs/schema/common';
import type { Weapon } from '../../packs/schema/cards';

// Card text formatting shared by the card renderer, dashboard, and print (DRY).

const ARMOR_RE = /^\s*(\d+)\s*\/\s*(\d+)\s*\+?\s*$/;

/** "2/6" → {dice:2, target:6}; null if malformed or out of schema bounds. */
export function parseArmor(text: string): Armor | null {
  const m = ARMOR_RE.exec(text);
  if (!m) return null;
  const parsed = ArmorSchema.safeParse({ dice: Number(m[1]), target: Number(m[2]) });
  return parsed.success ? parsed.data : null;
}

export function formatArmor(a: Armor): string {
  return `${a.dice}/${a.target}`;
}

type Profile = Pick<Weapon, 'minRange' | 'maxRange' | 'damage'>;

/** `4-16"/2`, `24"/1`, `12"`; '' when the weapon has no profile (ability-style). */
export function formatWeaponProfile(w: Profile): string {
  const { minRange: min, maxRange: max, damage } = w;
  const range = max === undefined ? '' : min !== undefined && min > 0 ? `${min}-${max}"` : `${max}"`;
  if (damage === undefined) return range;
  return `${range || '—'}/${damage}`;
}

/** "core:data-knife" → "Data Knife": fallback when the keyword definition isn't loaded. */
export function humanizeKey(key: string): string {
  const local = key.slice(key.lastIndexOf(':') + 1);
  return local
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** {key:"core:blast", x:1} → "Blast (1)". `resolveName` maps a key to its loaded Keyword name. */
export function formatKeywordRef(ref: KeywordRef, resolveName?: (key: string) => string | undefined): string {
  const name = resolveName?.(ref.key) ?? humanizeKey(ref.key);
  return ref.x === undefined ? name : `${name} (${ref.x})`;
}

export function formatKeywordList(refs: readonly KeywordRef[], resolveName?: (key: string) => string | undefined): string {
  return refs.map((r) => formatKeywordRef(r, resolveName)).join(', ');
}
