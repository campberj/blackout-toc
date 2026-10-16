import { createEventStore, replay, type StoredEvent } from '../events';
import { err, ok, type Result } from '../result';
import { validateGameEvent, type GameCommandInput, type GameEvent } from './commands';
import { decideGame, type GameIssue } from './decider';
import { gameReducer } from './reducer';
import type { GameSetupInput } from './schema';
import { initialGameState, type GameState } from './state';

/** Why a command was refused. `overridable` ⇒ resend with `force: true` to accept. */
export interface GameRejection {
  readonly message: string;
  readonly issues: readonly GameIssue[];
  readonly overridable: boolean;
}

export interface GameAccepted {
  readonly state: GameState;
  readonly events: GameEvent[];
  readonly warnings: GameIssue[];
}

export type GameDispatchResult = Result<GameAccepted, GameRejection>;

/**
 * Event-sourced game session (DESIGN §4 F3): `state = replay(initialGameState(), events)`.
 * Content-free: GameStarted/UnitAdded snapshot everything the board needs.
 */
export interface GameEngine {
  start(setup: GameSetupInput, opts?: { at?: string }): GameDispatchResult;
  dispatch(command: GameCommandInput, opts?: { at?: string }): GameDispatchResult;
  /** Issues a command would raise, without committing. */
  check(command: GameCommandInput): GameIssue[];
  /** Remove the last command's events (the start is never undone). Returns false when nothing to undo. */
  undo(): boolean;
  load(events: readonly StoredEvent<GameEvent>[]): Result<GameState, string>;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export const replayGame = (events: readonly GameEvent[]): GameState => replay(initialGameState(), events, gameReducer);

export function createGameEngine(): GameEngine {
  const store = createEventStore<GameState, GameCommandInput, GameEvent>({
    init: initialGameState(),
    reduce: gameReducer,
    decide: (s, c) => {
      const d = decideGame(s, c);
      return d.ok ? { ok: true, events: d.events } : { ok: false, error: d.error };
    },
  });

  const dispatch = (command: GameCommandInput, at?: string): GameDispatchResult => {
    const d = decideGame(store.state, command);
    if (!d.ok) return err({ message: d.error, issues: d.issues, overridable: d.issues.every((i) => i.severity === 'warn' || i.overridable) });
    const r = store.dispatch(command, at === undefined ? undefined : { at });
    /* v8 ignore next -- same decider, same state: cannot diverge */
    if (!r.ok) return err({ message: r.error, issues: d.issues, overridable: false });
    return ok({ state: r.state, events: r.events, warnings: d.issues.filter((i) => i.severity === 'warn') });
  };

  return {
    start: (setup, opts) => dispatch({ type: 'startGame', setup }, opts?.at),
    dispatch: (command, opts) => dispatch(command, opts?.at),
    check: (command) => decideGame(store.state, command).issues,
    undo() {
      const events = store.events;
      if (events.length === 0 || events.at(-1)!.cmd === events[0]!.cmd) return false;
      store.undo();
      return true;
    },
    load(events) {
      for (const e of events) {
        const msg = validateGameEvent(e);
        if (msg) return err(msg);
      }
      if (events.length && events[0]!.type !== 'GameStarted') return err('A game log must begin with GameStarted');
      const r = store.load(events);
      return r.ok ? ok(r.state) : err(r.error);
    },
    get state() {
      return store.state;
    },
    get events() {
      return store.events;
    },
  };
}
