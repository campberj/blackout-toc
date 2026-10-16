import type { AarPrefill, OperatorObservation } from '../../app/contracts/game-campaign';
import { hasDamage, score, type GameState, type ModelState } from './state';

// Dashboard → campaign AAR pre-fill (D18). Casualty rolls stay in the AAR form; this only reports
// what the table showed.

export function observedStatus(m: ModelState): OperatorObservation['status'] {
  if (m.status === 'destroyed') return 'destroyed';
  if (m.status === 'down' || m.status === 'captured') return 'down';
  return hasDamage(m) ? 'damaged' : 'ok';
}

/** Undefined for unlinked sessions. Outcome is left to the player (outcome keys are pack-specific). */
export function toAarPrefill(s: GameState): AarPrefill | undefined {
  if (!s.link) return undefined;
  const operators: Record<string, OperatorObservation> = {};
  for (const u of s.units) {
    if (u.side !== 'player') continue;
    for (const m of u.models) {
      if (m.operatorKey) operators[m.operatorKey] = { participated: m.deployed, kills: m.kills, status: observedStatus(m) };
    }
  }
  const scoreLine = `Final ${s.scoreLabel}: ${s.sides.player.name} ${score(s, 'player')}, ${s.sides.opfor.name} ${score(s, 'opfor')} after ${s.round} round${s.round === 1 ? '' : 's'}.`;
  return {
    campaignSaveId: s.link.campaignSaveId,
    mission: s.link.mission,
    operators,
    rounds: s.round,
    notes: [scoreLine, ...s.notes.map((n) => `R${n.round}: ${n.text}`)].join('\n'),
  };
}
