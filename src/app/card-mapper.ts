import type { ContentLookup } from '../domain/content';
import { formatArmor, formatKeywordList, formatKeywordRef, formatWeaponProfile, humanizeKey } from '../domain/cards/format';
import type { Ability, ArmoryItem, ForceCard, Id, KeywordRef, Specialist, UnitCard, Weapon } from '../packs/schema';
import type { CardRuleVM, CardViewModel, CardWeaponVM } from './view-models/card-view-model';
import type { ForceAbilityVM, ForceArmoryVM, ForceCardViewModel } from './view-models/force-card-view-model';

// Domain cards → display view models. Order is stable and documented because the dashboard
// indexes tracker state by array position: unit items first (pack order), then each specialist's
// items (specialist order, then item order). `cardKeys` returns the matching source keys.

export interface CardContext {
  readonly lookup: ContentLookup;
  /** Active ruleset: picks per-ruleset keyword text. */
  readonly rulesetId?: Id | undefined;
}

/** Source keys index-aligned with CardViewModel arrays. Specialist items are `specialistKey/itemKey`. */
export interface CardKeys {
  weapons: string[];
  rules: string[];
  damageTracks: string[];
}

export interface KeywordGlossaryEntry {
  key: string;
  name: string;
  text: string;
}

const TYPE_LABEL: Record<UnitCard['type'], string> = {
  infantry: 'Infantry',
  handler: 'Handler',
  duster: 'Duster',
  vehicle: 'Vehicle',
  hostile: 'Hostile',
};

const keywordName = (lookup: ContentLookup) => (key: string) => lookup.get('keyword', key as Id)?.name;
const factionName = (lookup: ContentLookup, id: string) => lookup.get('faction', id as Id)?.name ?? humanizeKey(id);
const uses = (n: number | undefined) => (n === undefined ? '' : n === 1 ? '1 use' : `${n} uses`);
const join = (parts: readonly string[], sep = '  ') => parts.filter(Boolean).join(sep);

/** Profile, keywords and limited uses on one line; falls back to text for ability-style weapons. */
function weaponProfile(w: Weapon, lookup: ContentLookup): string {
  return join([formatWeaponProfile(w), formatKeywordList(w.keywords, keywordName(lookup)), uses(w.usesMax)]) || (w.text ?? '');
}

const prefixed = (sp: Specialist | undefined, name: string) => (sp ? `${sp.name}: ${name}` : name);

/** Unit items then specialist items, each tagged with its specialist (single source of ordering). */
function ordered<T>(unit: UnitCard, pick: (o: UnitCard | Specialist) => readonly T[]): { item: T; sp?: Specialist }[] {
  return [...pick(unit).map((item) => ({ item })), ...unit.specialists.flatMap((sp) => pick(sp).map((item) => ({ item, sp })))];
}

function specialistText(sp: Specialist, lookup: ContentLookup): string | undefined {
  const text = join(
    [
      sp.skill === undefined ? '' : `Skill ${sp.skill}+`,
      sp.move === undefined ? '' : `Move ${sp.move}"`,
      sp.armor === undefined ? '' : `Armor ${formatArmor(sp.armor)}`,
      formatKeywordList(sp.keywords, keywordName(lookup)),
    ],
    ' · ',
  );
  return text || undefined;
}

export function toCardViewModel(unit: UnitCard, ctx: CardContext): CardViewModel {
  const { lookup } = ctx;
  const weapons: CardWeaponVM[] = ordered(unit, (o) => o.weapons).map(({ item, sp }) => ({
    name: prefixed(sp, item.name),
    profile: weaponProfile(item, lookup),
  }));
  const rules: CardRuleVM[] = ordered(unit, (o) => o.rules).map(({ item, sp }) => ({
    name: prefixed(sp, item.name),
    text: item.text,
    ...(item.usesMax === undefined ? {} : { usesMax: item.usesMax }),
  }));
  const keywords = unit.keywords.map((r) => formatKeywordRef(r, keywordName(lookup)));
  return {
    id: unit.id,
    name: unit.name,
    faction: factionName(lookup, unit.faction),
    type: TYPE_LABEL[unit.type],
    stats: [
      { label: 'Skill', value: `${unit.skill}+` },
      { label: 'Move', value: `${unit.move}"` },
    ],
    armor: formatArmor(unit.armor),
    grunts: unit.grunts,
    specialists: unit.specialists.map((sp) => {
      const text = specialistText(sp, lookup);
      return text === undefined ? { name: sp.name } : { name: sp.name, text };
    }),
    combatLoads: unit.combatLoads,
    rules,
    weapons,
    damageTracks: (unit.damageTracks ?? []).map((t) => ({ name: t.name, size: t.size })),
    ...(keywords.length ? { keywords } : {}),
    ...(isCustom(unit) ? { custom: true } : {}),
  };
}

export const isCustom = (unit: UnitCard): boolean => unit.source?.custom === true || unit.id.startsWith('user:');

export function cardKeys(unit: UnitCard): CardKeys {
  const key = ({ item, sp }: { item: { key: string }; sp?: Specialist }) => (sp ? `${sp.key}/${item.key}` : item.key);
  return {
    weapons: ordered(unit, (o) => o.weapons).map(key),
    rules: ordered(unit, (o) => o.rules).map(key),
    damageTracks: (unit.damageTracks ?? []).map((t) => t.key),
  };
}

/** Every keyword on the card (model, weapons, specialists), first-appearance order, ruleset text. */
export function keywordGlossary(unit: UnitCard, ctx: CardContext): KeywordGlossaryEntry[] {
  const refs: KeywordRef[] = [
    ...unit.keywords,
    ...unit.weapons.flatMap((w) => w.keywords),
    ...unit.specialists.flatMap((s) => [...s.keywords, ...s.weapons.flatMap((w) => w.keywords)]),
  ];
  const seen = new Set<string>();
  return refs.flatMap((r) => {
    if (seen.has(r.key)) return [];
    seen.add(r.key);
    const key = r.key as Id;
    return [{ key, name: keywordName(ctx.lookup)(key) ?? humanizeKey(key), text: ctx.lookup.keywordText(key, ctx.rulesetId) ?? '' }];
  });
}

const cost = (a: Ability) => (a.cpCost === undefined ? {} : { cost: `${a.cpCost} CP` });
const usesMax = (n: number | undefined) => (n === undefined ? {} : { usesMax: n });

function ability(a: Ability): ForceAbilityVM {
  return { name: a.name, text: a.text, ...cost(a), ...usesMax(a.usesMax) };
}

function armoryItem(it: ArmoryItem, lookup: ContentLookup): ForceArmoryVM {
  if (it.kind === 'ability') return { kind: 'ability', name: it.ability.name, profile: '', text: it.ability.text, ...cost(it.ability), ...usesMax(it.ability.usesMax) };
  const w = it.weapon;
  return { kind: 'weapon', name: w.name, profile: join([formatWeaponProfile(w), formatKeywordList(w.keywords, keywordName(lookup))]), ...(w.text === undefined ? {} : { text: w.text }), ...usesMax(w.usesMax) };
}

export function toForceCardViewModel(force: ForceCard, ctx: CardContext): ForceCardViewModel {
  return {
    id: force.id,
    name: force.name,
    faction: factionName(ctx.lookup, force.faction),
    forceRule: force.forceRule,
    battleDrills: force.battleDrills.map(ability),
    armory: force.armory.map((it) => armoryItem(it, ctx.lookup)),
    dusterArmory: force.dusterArmory.map((it) => armoryItem(it, ctx.lookup)),
  };
}
