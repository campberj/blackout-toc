/*
 * Presentation model for CardView. Deliberately decoupled from the domain/pack
 * schemas: a mapper (domain UnitCard → CardViewModel) is added later, so every
 * field here is already display-ready (formatted strings, resolved names).
 */

export interface CardStatVM {
  label: string;
  value: string;
}

export interface CardWeaponVM {
  name: string;
  /** Preformatted profile, e.g. range / damage / keywords. */
  profile: string;
}

export interface CardSpecialistVM {
  name: string;
  text?: string;
}

export interface CardRuleVM {
  name: string;
  text: string;
  /** Number of use-boxes; omit for always-on rules. */
  usesMax?: number;
}

export interface CardTrackVM {
  name: string;
  size: number;
}

export interface CardViewModel {
  id: string;
  name: string;
  faction: string;
  /** Display label, e.g. "Infantry", "Handler". */
  type: string;
  /** Core stat line in display order (Skill, Move …). */
  stats: CardStatVM[];
  /** e.g. "1/5". */
  armor: string;
  grunts: number;
  specialists: CardSpecialistVM[];
  combatLoads: number;
  rules: CardRuleVM[];
  weapons: CardWeaponVM[];
  damageTracks: CardTrackVM[];
  keywords?: string[];
  /** True for user-forged units (shows a marker). */
  custom?: boolean;
}

/** Live tracker values for one card in play (dashboard). Index-aligned with the VM arrays. */
export interface CardTrackerState {
  combatLoadsUsed: number;
  /** ruleUses[i] = boxes ticked for rules[i]. */
  ruleUses: number[];
  /** damage[i] = boxes marked on damageTracks[i]. */
  damage: number[];
}

export function emptyTrackerState(card: CardViewModel): CardTrackerState {
  return {
    combatLoadsUsed: 0,
    ruleUses: card.rules.map(() => 0),
    damage: card.damageTracks.map(() => 0),
  };
}

export type CardVariant = 'compact' | 'full' | 'print';
