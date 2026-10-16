import { humanizeKey } from '../cards/format';
import type { GameEvent } from './commands';
import type { GameState } from './state';

// Human-readable log lines. Names resolve against the final state (units are never removed).

export interface LogEntry {
  readonly seq: number;
  readonly cmd: number;
  readonly round: number;
  readonly at?: string;
  readonly type: GameEvent['type'];
  readonly text: string;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function describeEvent(e: GameEvent, s: GameState): string {
  const side = (k: 'player' | 'opfor') => s.sides[k].name;
  const unit = (k: string) => s.units.find((u) => u.key === k);
  const unitName = (k: string) => unit(k)?.name ?? k;
  const modelName = (u: string, m: string) => {
    const x = unit(u);
    const mm = x?.models.find((y) => y.key === m);
    return mm ? (x!.models.length === 1 ? mm.name : `${mm.name} (${x!.name})`) : `${m} (${unitName(u)})`;
  };
  switch (e.type) {
    case 'GameStarted':
      return `Game started: ${e.payload.setup.name}`;
    case 'UnitAdded':
      return `${e.payload.unit.name} joined ${side(e.payload.unit.side)}`;
    case 'RoundAdvanced':
      return `Round ${e.payload.round} begins`;
    case 'PhaseSet':
      return `${humanizeKey(e.payload.phase)} phase`;
    case 'InitiativeSet':
      return e.payload.side ? `${side(e.payload.side)} has initiative` : 'Initiative cleared';
    case 'CpSpent':
      return `${side(e.payload.side)} spent ${e.payload.amount} CP${e.payload.reason ? ` (${humanizeKey(e.payload.reason)})` : ''}`;
    case 'CpAdjusted':
      return `${side(e.payload.side)} CP ${signed(e.payload.amount)}`;
    case 'VpAdjusted':
      return `${side(e.payload.side)} ${s.scoreLabel} ${signed(e.payload.amount)}`;
    case 'BurnCardsAdjusted':
      return `${side(e.payload.side)} burn cards ${signed(e.payload.amount)}`;
    case 'TokenSet': {
      const who = e.payload.model ? modelName(e.payload.unit, e.payload.model) : unitName(e.payload.unit);
      return `${who}: ${e.payload.value ? '' : 'cleared '}${e.payload.token}`;
    }
    case 'DrillUsed':
      return `${unitName(e.payload.unit)} used a battle drill`;
    case 'LoadSpent':
      return `${unitName(e.payload.unit)} combat loads used: ${e.payload.used}`;
    case 'RuleBoxTicked': {
      const r = unit(e.payload.unit)?.rules.find((x) => x.key === e.payload.rule);
      return `${unitName(e.payload.unit)}: ${r?.name ?? e.payload.rule} ${e.payload.ticked}/${r?.usesMax ?? '?'}`;
    }
    case 'DamageMarked': {
      const t = unit(e.payload.unit)?.tracks.find((x) => x.key === e.payload.track);
      return `${modelName(e.payload.unit, e.payload.model)}: ${t?.name ?? e.payload.track} ${e.payload.marked}/${t?.size ?? '?'}`;
    }
    case 'ModelStatusChanged':
      return `${modelName(e.payload.unit, e.payload.model)} is ${e.payload.status}`;
    case 'KillCredited':
      return `${modelName(e.payload.unit, e.payload.model)} kills ${signed(e.payload.delta)}`;
    case 'ObjectiveScored': {
      const o = s.objectives.find((x) => x.key === e.payload.objective);
      return `${side(e.payload.side)} ${e.payload.delta > 0 ? 'scored' : 'unscored'} ${o?.label ?? e.payload.objective}`;
    }
    case 'ObjectiveAdded':
      return `Objective added: ${e.payload.label} (${e.payload.points} ${s.scoreLabel})`;
    case 'Note':
      return e.payload.text;
    case 'GameEnded':
      return 'Game ended';
  }
}

/** Chronological entries with the round each event happened in. */
export function gameLog(events: readonly GameEvent[], s: GameState): LogEntry[] {
  let round = 1;
  return events.map((e) => {
    if (e.type === 'RoundAdvanced') round = e.payload.round;
    return { seq: e.seq, cmd: e.cmd, round, type: e.type, text: describeEvent(e, s), ...(e.at === undefined ? {} : { at: e.at }) };
  });
}
