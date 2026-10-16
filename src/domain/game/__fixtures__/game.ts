// Test-only: invented content (demo pack) → game setups.
import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import { lookupFromPacks } from '../../campaign/__fixtures__/lookup';
import type { Roster } from '../../roster';
import type { GameCommandInput, GameEngine } from '../index';
import { createGameEngine, setupFromRoster } from '../index';

export const lookup = () => lookupFromPacks(structuredClone(demo));

export const roster = (over: Partial<Roster> = {}): Roster => ({
  id: 'r1',
  name: 'Ember Team',
  rulesetId: 'demo:house',
  mode: 'matched',
  groups: [{ forceCardId: 'demo:lantern-detachment', handlerId: 'demo:warden-captain', unitIds: ['demo:lantern-wardens'] }],
  notes: '',
  ...over,
});

export function builtSetup(withScenario = true) {
  const r = setupFromRoster({ roster: roster(), lookup: lookup(), ...(withScenario ? { scenarioId: 'demo:lamp-recovery' as const } : {}) });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

export function startedEngine(withScenario = true): GameEngine {
  const e = createGameEngine();
  const r = e.start(builtSetup(withScenario).setup, { at: '2026-10-16T12:00:00.000Z' });
  if (!r.ok) throw new Error(r.error.message);
  return e;
}

/** Dispatch or throw (scripts). */
export function must(e: GameEngine, c: GameCommandInput) {
  const r = e.dispatch(c);
  if (!r.ok) throw new Error(`${c.type}: ${r.error.message}`);
  return r.value;
}
