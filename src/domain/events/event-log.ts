// Generic event-sourcing kernel (DESIGN §4 GameSession, §6 Campaign). No domain knowledge here.

/** A persisted fact. `seq` is 1-based and strictly increasing within a log. */
export interface DomainEvent<T extends string = string, P = unknown> {
  readonly seq: number;
  readonly type: T;
  /** ISO timestamp supplied by the app's Clock port; domain never reads a clock. */
  readonly at?: string;
  readonly payload: P;
}

/** An event before it is sequenced (distributes over event unions). */
export type EventDraft<E extends DomainEvent> = E extends DomainEvent<infer T, infer P> ? { type: T; payload: P } : never;

/** Pure state transition. Must never throw on an event its decider emitted. */
export type Reducer<S, E> = (state: S, event: E) => S;

export type Decision<E extends DomainEvent> = { ok: true; events: EventDraft<E>[] } | { ok: false; error: string };

/** Validates a command against current state and emits event drafts (or a rejection). */
export type Decider<S, C, E extends DomainEvent> = (state: S, command: C) => Decision<E>;

/** Immutable, append-only list of events. */
export interface EventLog<E extends DomainEvent> {
  readonly events: readonly E[];
}

export const emptyLog = <E extends DomainEvent>(): EventLog<E> => ({ events: [] });

export const lastSeq = (log: EventLog<DomainEvent>): number => log.events.at(-1)?.seq ?? 0;

/** Sequence drafts onto the log. Returns the new log and the appended events. */
export function append<E extends DomainEvent>(
  log: EventLog<E>,
  drafts: readonly EventDraft<E>[],
  at?: string,
): { log: EventLog<E>; appended: E[] } {
  let seq = lastSeq(log);
  const appended = drafts.map((d) => ({ seq: ++seq, type: d.type, ...(at === undefined ? {} : { at }), payload: d.payload }) as unknown as E);
  return { log: { events: [...log.events, ...appended] }, appended };
}

/** Truncate the log *to* `seq`: keeps events with `e.seq <= seq` (`undo(log, 0)` empties it). */
export function undo<E extends DomainEvent>(log: EventLog<E>, seq: number): EventLog<E> {
  return { events: log.events.filter((e) => e.seq <= seq) };
}

/** Fold events over an initial state. */
export function replay<S, E>(init: S, events: readonly E[], reducer: Reducer<S, E>): S {
  return events.reduce(reducer, init);
}

/** Checks a persisted log is well-formed (1-based, contiguous seq). */
export function validateLog(events: readonly DomainEvent[]): string | undefined {
  for (let i = 0; i < events.length; i++) {
    if (events[i]!.seq !== i + 1) return `Event at index ${i} has seq ${events[i]!.seq}, expected ${i + 1}`;
  }
  return undefined;
}
