import { append, emptyLog, replay, undo, validateLog, type Decider, type DomainEvent, type EventLog, type Reducer } from './event-log';

export type DispatchResult<S, E> = { ok: true; state: S; events: E[] } | { ok: false; error: string };

export interface EventStoreSpec<S, C, E extends DomainEvent> {
  init: S;
  reduce: Reducer<S, E>;
  decide: Decider<S, C, E>;
}

/** In-memory command → event → state loop. Persistence lives behind ports, not here. */
export interface EventStore<S, C, E extends DomainEvent> {
  readonly state: S;
  readonly events: readonly E[];
  /** Validate, append, reduce. Rejected commands leave the store untouched. */
  dispatch(command: C, opts?: { at?: string }): DispatchResult<S, E>;
  /** Same as dispatch but discards the result. */
  preview(command: C): DispatchResult<S, E>;
  /** Truncate to `seq` (keep `e.seq <= seq`) and rebuild state by replay. */
  undo(seq: number): S;
  /** Replace the log (e.g. from storage) and rebuild state by replay. */
  load(events: readonly E[]): { ok: true; state: S } | { ok: false; error: string };
}

export function createEventStore<S, C, E extends DomainEvent>(spec: EventStoreSpec<S, C, E>): EventStore<S, C, E> {
  let log: EventLog<E> = emptyLog<E>();
  let state = spec.init;

  const run = (command: C, at?: string): (DispatchResult<S, E> & { log?: EventLog<E> }) => {
    const d = spec.decide(state, command);
    if (!d.ok) return d;
    const next = append(log, d.events, at);
    return { ok: true, state: replay(state, next.appended, spec.reduce), events: next.appended, log: next.log };
  };

  return {
    get state() {
      return state;
    },
    get events() {
      return log.events;
    },
    dispatch(command, opts) {
      const r = run(command, opts?.at);
      if (!r.ok) return r;
      log = r.log!;
      state = r.state;
      return { ok: true, state: r.state, events: r.events };
    },
    preview(command) {
      const r = run(command);
      return r.ok ? { ok: true, state: r.state, events: r.events } : r;
    },
    undo(seq) {
      log = undo(log, seq);
      state = replay(spec.init, log.events, spec.reduce);
      return state;
    },
    load(events) {
      const err = validateLog(events);
      if (err) return { ok: false, error: err };
      log = { events: [...events] };
      state = replay(spec.init, log.events, spec.reduce);
      return { ok: true, state };
    },
  };
}
