import type { GameLaunchRequest } from '../../app/contracts/game-campaign';
import type { ContentLookup } from '../content';
import { err, ok, type Result } from '../result';
import type { Roster } from '../roster';
import type { Id, InlineScenario, RulesetProfile, Scenario, UnitCard } from '$lib/packs/schema';
import type { CustomContact, GameSetupInput, ModelSetup, ObjectiveSetup, Side, UnitTemplate } from './schema';

// Builders: content (roster, scenario, ruleset, launch request) → content-free setup snapshots.

/** Used when no ruleset is loaded (a launch must still open a board). */
export const FALLBACK_PROFILE = { startingCp: 3, roundLimit: 5, cpCaps: {} as Record<string, number> };

const packOf = (id: string) => id.slice(0, id.indexOf(':'));
/** Pack refs may be bare (same pack) depending on the loader stage; qualify against the owner. */
const qualify = (ref: string, owner: string): Id => (ref.includes(':') ? ref : `${packOf(owner)}:${ref}`) as Id;

/** Specialists by name, then grunts; `modelCount` (2nd edition) wins when present. */
export function modelsForCard(card: UnitCard): ModelSetup[] {
  const count = card.modelCount ?? Math.max(1, card.grunts + card.specialists.length);
  const specialists = card.specialists.map((sp) => ({ key: sp.key, name: sp.name, status: 'active' as const }));
  const fill = Math.max(0, count - specialists.length);
  const grunts = Array.from({ length: fill }, (_, i) => ({ key: `g${i + 1}`, name: count === 1 ? card.name : `Grunt ${i + 1}`, status: 'active' as const }));
  return [...specialists, ...grunts].slice(0, count);
}

/** Limited-use rules (unit, then specialists as `sp/key`) — same order and keys as the card mapper. */
export function limitedRules(card: UnitCard): UnitTemplate['rules'] {
  return [
    ...card.rules.map((r) => ({ key: r.key, name: r.name, usesMax: r.usesMax })),
    ...card.specialists.flatMap((sp) => sp.rules.map((r) => ({ key: `${sp.key}/${r.key}`, name: `${sp.name}: ${r.name}`, usesMax: r.usesMax }))),
  ].flatMap((r) => (r.usesMax === undefined ? [] : [{ key: r.key, name: r.name, usesMax: r.usesMax }]));
}

export function templateFromCard(card: UnitCard, opts: { forceId?: Id | undefined; group?: number; name?: string; models?: ModelSetup[] } = {}): UnitTemplate {
  return {
    name: opts.name ?? card.name,
    unitId: card.id as Id,
    ...(opts.forceId ? { forceId: opts.forceId } : {}),
    ...(opts.group === undefined ? {} : { group: opts.group }),
    combatLoads: card.combatLoads,
    rules: limitedRules(card),
    tracks: (card.damageTracks ?? []).map((t) => ({ key: t.key, name: t.name, size: t.size })),
    models: opts.models ?? modelsForCard(card),
  };
}

export function templateFromContact(c: CustomContact): UnitTemplate {
  return {
    name: c.name,
    combatLoads: 0,
    rules: [],
    tracks: c.track ? [{ key: 'damage', name: c.track.name, size: c.track.size }] : [],
    models: Array.from({ length: c.models }, (_, i) => ({ key: `m${i + 1}`, name: c.models === 1 ? c.name : `${c.name} ${i + 1}`, status: 'active' as const })),
  };
}

type AnyScenario = (Scenario | InlineScenario) & { id?: string };

export interface ScenarioParts {
  roundLimit?: number;
  scoreLabel?: string;
  scenarioName?: string;
  opforName?: string;
  specialRules: GameSetupInput['specialRules'];
  objectives: ObjectiveSetup[];
  opfor: UnitTemplate[];
  missing: string[];
}

/** Player side = first side without fixed forces; OPFOR = first side with fixed forces (else the other side). */
export function scenarioParts(sc: AnyScenario | undefined, lookup: ContentLookup, owner = sc?.id ?? ''): ScenarioParts {
  if (!sc) return { specialRules: [], objectives: [], opfor: [], missing: [] };
  const sides = sc.forces.sides;
  const opforSide = sides.find((s) => s.units.length > 0) ?? sides[1];
  const playerSide = sides.find((s) => s !== opforSide);
  const sideOf = (key: string | undefined): Side | undefined =>
    key === undefined ? undefined : key === opforSide?.key ? 'opfor' : key === playerSide?.key ? 'player' : undefined;
  const missing: string[] = [];
  const opfor = sides.flatMap((side) =>
    side.units.flatMap(({ unit, count }) => {
      const id = qualify(unit, owner);
      const card = lookup.get('unit', id);
      if (!card) {
        missing.push(id);
        return [];
      }
      return Array.from({ length: count }, (_, i) => templateFromCard(card, count > 1 ? { name: `${card.name} ${i + 1}` } : {}));
    }),
  );
  return {
    roundLimit: sc.roundLimit,
    scoreLabel: sc.scoreLabel,
    scenarioName: sc.name,
    ...(opforSide ? { opforName: opforSide.name } : {}),
    specialRules: sc.specialRules.map((r) => ({ key: r.key, name: r.name, ...(r.text === undefined ? {} : { text: r.text }) })),
    objectives: sc.scoring.map((r) => {
      const side = sideOf(r.side);
      return {
        key: r.key,
        label: r.label,
        points: r.points,
        timing: r.timing,
        ...(r.max === undefined ? {} : { max: r.max }),
        ...(side ? { side } : {}),
        ...(r.text === undefined ? {} : { text: r.text }),
      };
    }),
    opfor,
    missing,
  };
}

export interface BuiltSetup {
  readonly setup: GameSetupInput;
  /** Card ids referenced but not loaded (skipped). */
  readonly missing: readonly string[];
}

function assemble(
  base: { name: string; ruleset?: RulesetProfile | undefined; rulesetId?: Id | undefined; playerName: string },
  parts: ScenarioParts,
  player: UnitTemplate[],
  extra: Partial<GameSetupInput>,
  missing: string[],
): BuiltSetup {
  const profile = base.ruleset ?? FALLBACK_PROFILE;
  const units = [...player.map((u) => ({ ...u, side: 'player' as const })), ...parts.opfor.map((u) => ({ ...u, side: 'opfor' as const }))];
  const counters = { player: 0, opfor: 0 };
  return {
    setup: {
      name: base.name,
      ...(base.rulesetId ? { rulesetId: base.rulesetId } : {}),
      roundLimit: parts.roundLimit ?? profile.roundLimit,
      startingCp: profile.startingCp,
      cpCaps: profile.cpCaps,
      ...(parts.scoreLabel ? { scoreLabel: parts.scoreLabel } : {}),
      ...(parts.scenarioName ? { scenarioName: parts.scenarioName } : {}),
      sides: { player: { name: base.playerName }, opfor: { name: parts.opforName ?? 'OPFOR' } },
      specialRules: parts.specialRules,
      objectives: parts.objectives,
      units: units.map((u) => ({ ...u, key: `${u.side === 'player' ? 'p' : 'o'}${++counters[u.side]}` })),
      ...extra,
    },
    missing: [...missing, ...parts.missing],
  };
}

function scenarioById(lookup: ContentLookup, id: Id | undefined): Result<Scenario | undefined, string> {
  if (!id) return ok(undefined);
  const sc = lookup.get('scenario', id);
  return sc ? ok(sc) : err(`Scenario "${id}" is not loaded`);
}

export function setupFromRoster(input: { roster: Roster; lookup: ContentLookup; scenarioId?: Id | undefined; name?: string | undefined }): Result<BuiltSetup, string> {
  const { roster, lookup } = input;
  const sc = scenarioById(lookup, input.scenarioId);
  if (!sc.ok) return sc;
  const missing: string[] = [];
  const card = (id: Id) => {
    const c = lookup.get('unit', id);
    if (!c) missing.push(id);
    return c;
  };
  const player: UnitTemplate[] = [];
  roster.groups.forEach((g, group) => {
    for (const id of [...(g.handlerId ? [g.handlerId] : []), ...g.unitIds]) {
      const c = card(id);
      if (c) player.push(templateFromCard(c, { forceId: g.forceCardId, group }));
    }
  });
  if (roster.dusterId) {
    const c = card(roster.dusterId);
    if (c) player.push(templateFromCard(c, { forceId: roster.groups[0]?.forceCardId, group: 0 }));
  }
  const ruleset = lookup.get('ruleset', roster.rulesetId);
  return ok(
    assemble(
      { name: input.name ?? roster.name, ruleset, rulesetId: roster.rulesetId, playerName: roster.name },
      scenarioParts(sc.value, lookup),
      player,
      { rosterId: roster.id, ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}) },
      missing,
    ),
  );
}

/** Campaign launch: operators become named models (carrying `operatorKey`), one unit per team + card. */
export function setupFromLaunch(input: { req: GameLaunchRequest; lookup: ContentLookup; rulesetId?: Id | undefined }): Result<BuiltSetup, string> {
  const { req, lookup } = input;
  const scenarioId = req.scenarioId as Id | undefined;
  const sc = scenarioById(lookup, scenarioId);
  if (!sc.ok) return sc;
  if (req.operators.length === 0) return err('Select at least one operator');
  const missing: string[] = [];
  const groups = new Map<string, GameLaunchRequest['operators'][number][]>();
  for (const op of req.operators) {
    const k = `${op.team}\u0000${op.unitId ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), op]);
  }
  const player = [...groups.values()].map((ops): UnitTemplate => {
    const { team, unitId } = ops[0]!;
    const models = ops.map((op) => ({ key: op.key, name: op.callsign ?? op.name, operatorKey: op.key, status: 'active' as const }));
    const c = unitId ? lookup.get('unit', unitId as Id) : undefined;
    if (unitId && !c) missing.push(unitId);
    return c ? templateFromCard(c, { name: `${c.name} (${team})`, models }) : { name: team, combatLoads: 0, rules: [], tracks: [], models };
  });
  const rulesetId = input.rulesetId;
  return ok(
    assemble(
      { name: req.missionName, ruleset: rulesetId ? lookup.get('ruleset', rulesetId) : undefined, rulesetId, playerName: 'Player' },
      scenarioParts(sc.value, lookup),
      player,
      { link: { campaignSaveId: req.campaignSaveId, mission: req.mission }, ...(scenarioId ? { scenarioId } : {}) },
      missing,
    ),
  );
}
