import type { GameEvent, GameEventOf, GameEventType } from './commands';
import type { Side, UnitSetup } from './schema';
import { emptySide, type GameState, type ModelState, type SideState, type UnitState } from './state';

// Pure, total reducer: events were validated by the decider (or payload schemas on load), so
// unknown unit/model keys are ignored rather than thrown on.

export function unitFromSetup(u: UnitSetup): UnitState {
  return {
    key: u.key,
    side: u.side,
    name: u.name,
    unitId: u.unitId ?? null,
    forceId: u.forceId ?? null,
    group: u.group ?? null,
    combatLoads: u.combatLoads,
    rules: u.rules,
    tracks: u.tracks,
    activated: false,
    pinned: false,
    drillUsed: false,
    loadsUsed: 0,
    ruleUses: {},
    models: u.models.map((m) => ({
      key: m.key,
      name: m.name,
      operatorKey: m.operatorKey ?? null,
      status: m.status,
      deployed: m.status !== 'reserve',
      ready: false,
      engaged: false,
      damage: {},
      kills: 0,
    })),
  };
}

const mapSide = (s: GameState, side: Side, fn: (x: SideState) => SideState): GameState => ({ ...s, sides: { ...s.sides, [side]: fn(s.sides[side]) } });
const mapUnit = (s: GameState, key: string, fn: (u: UnitState) => UnitState): GameState => ({
  ...s,
  units: s.units.map((u) => (u.key === key ? fn(u) : u)),
});
const mapModel = (s: GameState, unit: string, model: string, fn: (m: ModelState) => ModelState): GameState =>
  mapUnit(s, unit, (u) => ({ ...u, models: u.models.map((m) => (m.key === model ? fn(m) : m)) }));

type Handlers = { [K in GameEventType]: (s: GameState, p: GameEventOf<K>['payload'], e: GameEventOf<K>) => GameState };

const H: Handlers = {
  GameStarted: (s, { setup }) => ({
    ...s,
    started: true,
    name: setup.name,
    rulesetId: setup.rulesetId ?? null,
    rosterId: setup.rosterId ?? null,
    scenarioId: setup.scenarioId ?? null,
    scenarioName: setup.scenarioName ?? null,
    link: setup.link ?? null,
    round: 1,
    roundLimit: setup.roundLimit,
    phase: 'operations',
    startingCp: setup.startingCp,
    cpCaps: setup.cpCaps,
    capMode: setup.capMode,
    scoreLabel: setup.scoreLabel,
    specialRules: setup.specialRules,
    sides: { player: emptySide(setup.sides.player.name, setup.startingCp), opfor: emptySide(setup.sides.opfor.name, setup.startingCp) },
    units: setup.units.map(unitFromSetup),
    objectives: setup.objectives.map((o) => ({ ...o, custom: false, scored: { player: 0, opfor: 0 } })),
  }),
  UnitAdded: (s, { unit }) => ({ ...s, units: [...s.units, unitFromSetup(unit)] }),
  // Operations phase clears per-round tokens, drills and cap counters.
  RoundAdvanced: (s, { round }) => ({
    ...s,
    round,
    phase: 'operations',
    initiative: null,
    sides: { player: { ...s.sides.player, capUses: {} }, opfor: { ...s.sides.opfor, capUses: {} } },
    units: s.units.map((u) => ({
      ...u,
      activated: false,
      pinned: false,
      drillUsed: false,
      models: u.models.map((m) => (m.ready || m.engaged ? { ...m, ready: false, engaged: false } : m)),
    })),
  }),
  PhaseSet: (s, { phase }) => ({ ...s, phase }),
  InitiativeSet: (s, { side }) => ({ ...s, initiative: side }),
  CpSpent: (s, { side, amount, reason }) =>
    mapSide(s, side, (x) => ({
      ...x,
      cp: Math.max(0, x.cp - amount),
      capUses: reason && reason in s.cpCaps ? { ...x.capUses, [reason]: (x.capUses[reason] ?? 0) + 1 } : x.capUses,
    })),
  CpAdjusted: (s, { side, amount }) => mapSide(s, side, (x) => ({ ...x, cp: Math.max(0, x.cp + amount) })),
  VpAdjusted: (s, { side, amount }) => mapSide(s, side, (x) => ({ ...x, vpAdjust: x.vpAdjust + amount })),
  BurnCardsAdjusted: (s, { side, amount }) => mapSide(s, side, (x) => ({ ...x, burnCards: Math.max(0, x.burnCards + amount) })),
  TokenSet: (s, { unit, model, token, value }) =>
    token === 'ready' || token === 'engaged'
      ? model === undefined
        ? s
        : mapModel(s, unit, model, (m) => ({ ...m, [token]: value }))
      : mapUnit(s, unit, (u) => ({ ...u, [token]: value })),
  DrillUsed: (s, { unit }) => mapUnit(s, unit, (u) => ({ ...u, drillUsed: true })),
  LoadSpent: (s, { unit, used }) => mapUnit(s, unit, (u) => ({ ...u, loadsUsed: used })),
  RuleBoxTicked: (s, { unit, rule, ticked }) => mapUnit(s, unit, (u) => ({ ...u, ruleUses: { ...u.ruleUses, [rule]: ticked } })),
  DamageMarked: (s, { unit, model, track, marked }) => mapModel(s, unit, model, (m) => ({ ...m, damage: { ...m.damage, [track]: marked } })),
  ModelStatusChanged: (s, { unit, model, status }) => mapModel(s, unit, model, (m) => ({ ...m, status, deployed: m.deployed || status !== 'reserve' })),
  KillCredited: (s, { unit, model, delta }) => mapModel(s, unit, model, (m) => ({ ...m, kills: Math.max(0, m.kills + delta) })),
  ObjectiveScored: (s, { objective, side, delta }) => ({
    ...s,
    objectives: s.objectives.map((o) => (o.key === objective ? { ...o, scored: { ...o.scored, [side]: Math.max(0, o.scored[side] + delta) } } : o)),
  }),
  ObjectiveAdded: (s, p) => ({
    ...s,
    objectives: [...s.objectives, { ...p, timing: { when: 'immediate' }, custom: true, scored: { player: 0, opfor: 0 } }],
  }),
  Note: (s, { text }, e) => ({ ...s, notes: [...s.notes, { seq: e.seq, round: s.round, text }] }),
  GameEnded: (s) => ({ ...s, ended: true }),
};

export function gameReducer(s: GameState, e: GameEvent): GameState {
  const h = H[e.type] as (s: GameState, p: unknown, e: GameEvent) => GameState;
  return h ? h(s, e.payload, e) : s;
}
