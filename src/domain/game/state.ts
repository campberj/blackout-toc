import type { ModelStatus, ObjectiveSetup, Phase, Side, UnitSetup } from './schema';

// Game state: plain JSON so it persists, diffs and replays as-is.

export interface ModelState {
  key: string;
  name: string;
  operatorKey: string | null;
  status: ModelStatus;
  /** Ever on the table (false while it has only been in reserve). */
  deployed: boolean;
  ready: boolean;
  engaged: boolean;
  /** Track key → boxes marked. */
  damage: Record<string, number>;
  kills: number;
}

export interface UnitState {
  key: string;
  side: Side;
  name: string;
  unitId: string | null;
  forceId: string | null;
  group: number | null;
  combatLoads: number;
  rules: UnitSetup['rules'];
  tracks: UnitSetup['tracks'];
  activated: boolean;
  pinned: boolean;
  drillUsed: boolean;
  loadsUsed: number;
  /** Rule key → boxes ticked. */
  ruleUses: Record<string, number>;
  models: ModelState[];
}

export interface SideState {
  name: string;
  cp: number;
  /** Manual VP adjustments; objective points are derived (see `score`). */
  vpAdjust: number;
  burnCards: number;
  /** cpCaps key → spends this round. */
  capUses: Record<string, number>;
}

export interface ObjectiveState extends ObjectiveSetup {
  custom: boolean;
  scored: Record<Side, number>;
}

export interface NoteEntry {
  seq: number;
  round: number;
  text: string;
}

export interface GameState {
  started: boolean;
  ended: boolean;
  name: string;
  rulesetId: string | null;
  rosterId: string | null;
  scenarioId: string | null;
  scenarioName: string | null;
  link: { campaignSaveId: string; mission: string } | null;
  round: number;
  roundLimit: number;
  phase: Phase;
  initiative: Side | null;
  startingCp: number;
  cpCaps: Record<string, number>;
  capMode: 'block' | 'warn';
  scoreLabel: string;
  specialRules: { key: string; name: string; text?: string | undefined }[];
  sides: Record<Side, SideState>;
  units: UnitState[];
  objectives: ObjectiveState[];
  notes: NoteEntry[];
}

export const initialGameState = (): GameState => ({
  started: false,
  ended: false,
  name: '',
  rulesetId: null,
  rosterId: null,
  scenarioId: null,
  scenarioName: null,
  link: null,
  round: 0,
  roundLimit: 0,
  phase: 'operations',
  initiative: null,
  startingCp: 0,
  cpCaps: {},
  capMode: 'block',
  scoreLabel: 'VP',
  specialRules: [],
  sides: { player: emptySide('Player'), opfor: emptySide('OPFOR') },
  units: [],
  objectives: [],
  notes: [],
});

export const emptySide = (name: string, cp = 0): SideState => ({ name, cp, vpAdjust: 0, burnCards: 0, capUses: {} });

// ── Selectors ────────────────────────────────────────────────────────────
export const findUnit = (s: GameState, key: string): UnitState | undefined => s.units.find((u) => u.key === key);
export const findModel = (u: UnitState, key: string): ModelState | undefined => u.models.find((m) => m.key === key);
export const unitsOf = (s: GameState, side: Side): UnitState[] => s.units.filter((u) => u.side === side);

/** Objective points + manual adjustments. */
export function score(s: GameState, side: Side): number {
  return s.objectives.reduce((n, o) => n + o.scored[side] * o.points, s.sides[side].vpAdjust);
}

/** Removed from play: counts against "units left" style checks. */
export const isOut = (m: ModelState): boolean => m.status === 'destroyed' || m.status === 'captured' || m.status === 'escaped';

export const hasDamage = (m: ModelState): boolean => Object.values(m.damage).some((n) => n > 0);

/** "Score at end of R2, R4" style reminder text for an objective, or null when immediate. */
export function timingText(o: Pick<ObjectiveSetup, 'timing'>): string | null {
  const { when, rounds } = o.timing;
  if (when === 'immediate') return rounds?.length ? `Score during R${rounds.join(', R')}` : null;
  if (when === 'end-of-game') return 'Score at end of game';
  return rounds?.length ? `Score at end of R${rounds.join(', R')}` : 'Score at end of each round';
}

/** Objectives whose scoring window is the current round (end-of-round) or the last round (end-of-game). */
export function dueObjectives(s: GameState): ObjectiveState[] {
  return s.objectives.filter((o) => {
    const { when, rounds } = o.timing;
    if (when === 'end-of-game') return s.round >= s.roundLimit;
    if (when === 'end-of-round') return !rounds?.length || rounds.includes(s.round);
    return false;
  });
}
