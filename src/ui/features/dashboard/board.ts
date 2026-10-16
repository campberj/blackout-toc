import { cardKeys, toCardViewModel, type CardContext, type GameCommandInput, type ModelState, type ModelStatus, type UnitState } from '$lib/app';
import type { CardTrackerState, CardViewModel } from '$lib/app/view-models/card-view-model';
import type { CardTrackerChange } from '../../components/card/CardView.svelte';
import type { Status } from '../../components/StatusBadge.svelte';

// Session unit → shared card renderer. Damage lives per model: single-model units show it on the
// card; multi-model units show it on each model chip instead.

export interface UnitView {
  card: CardViewModel;
  tracker: CardTrackerState;
  /** Session rule key per card rule (null = always-on rule). */
  ruleKeys: (string | null)[];
  /** True when damage is tracked on model chips rather than the card. */
  perModelDamage: boolean;
}

function syntheticCard(u: UnitState): CardViewModel {
  return {
    id: u.key,
    name: u.name,
    faction: '',
    type: u.unitId ? 'Unit (card not loaded)' : 'Contact',
    stats: [],
    armor: '—',
    grunts: 0,
    specialists: [],
    combatLoads: u.combatLoads,
    rules: u.rules.map((r) => ({ name: r.name, text: '', usesMax: r.usesMax })),
    weapons: [],
    damageTracks: [],
  };
}

export function unitView(u: UnitState, ctx: CardContext | null): UnitView {
  const source = u.unitId && ctx ? ctx.lookup.get('unit', u.unitId as never) : undefined;
  const base = source && ctx ? toCardViewModel(source, ctx) : syntheticCard(u);
  const tracked = new Set(u.rules.map((r) => r.key));
  const ruleKeys = source ? cardKeys(source).rules.map((k) => (tracked.has(k) ? k : null)) : u.rules.map((r) => r.key);
  const single = u.models.length === 1;
  const card: CardViewModel = { ...base, combatLoads: u.combatLoads, damageTracks: single ? u.tracks.map((t) => ({ name: t.name, size: t.size })) : [] };
  const m0 = u.models[0]!;
  return {
    card,
    ruleKeys,
    perModelDamage: !single && u.tracks.length > 0,
    tracker: {
      combatLoadsUsed: u.loadsUsed,
      ruleUses: ruleKeys.map((k) => (k ? (u.ruleUses[k] ?? 0) : 0)),
      damage: single ? u.tracks.map((t) => m0.damage[t.key] ?? 0) : [],
    },
  };
}

/** Card tap → session command (null when the tapped box is not tracked). */
export function trackerCommand(u: UnitState, view: UnitView, c: CardTrackerChange): GameCommandInput | null {
  if (c.kind === 'loads') return { type: 'setLoads', unit: u.key, used: c.value };
  if (c.kind === 'rule') {
    const rule = view.ruleKeys[c.index];
    return rule ? { type: 'setRuleBoxes', unit: u.key, rule, ticked: c.value } : null;
  }
  const track = u.tracks[c.index];
  return track ? { type: 'setDamage', unit: u.key, model: u.models[0]!.key, track: track.key, marked: c.value } : null;
}

export const STATUS_META: Record<ModelStatus, { label: string; tone: Status }> = {
  active: { label: 'Active', tone: 'ok' },
  down: { label: 'Down', tone: 'warn' },
  destroyed: { label: 'Destroyed', tone: 'crit' },
  embarked: { label: 'Embarked', tone: 'info' },
  reserve: { label: 'Reserve', tone: 'neutral' },
  escaped: { label: 'Escaped', tone: 'info' },
  captured: { label: 'Captured', tone: 'crit' },
};

/** "2/3 Wounds" style damage summary for a model chip; '' without tracks. */
export function damageSummary(u: UnitState, m: ModelState): string {
  return u.tracks.map((t) => `${m.damage[t.key] ?? 0}/${t.size}`).join(' ');
}

/** Models still fighting / total, for condensed rows. */
export function strength(u: UnitState): { up: number; total: number } {
  return { up: u.models.filter((m) => m.status === 'active' || m.status === 'embarked').length, total: u.models.length };
}
