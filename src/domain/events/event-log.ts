// Generic event-sourcing kernel (DESIGN §4 GameSession, §6 Campaign). No domain knowledge here.

/** A persisted fact. `seq` is 1-based and strictly increasing within a log. */
export interface DomainEvent<T extends string = string, P = unknown> {
  readonly seq: number;
  /** Sequence number of the dispatching command; every event from one dispatch shares it (undo unit). */
  readonly cmd: number;
  readonly type: T;
  /** ISO timestamp supplied by the app's Clock port; domain never reads a clock. */
  readonly at?: string;
  readonly payload: P;
}

/** Persisted form: logs written before per-command undo have no `cmd`. */
export type StoredEvent<E extends DomainEvent> = E extends DomainEvent ? Omit<E, 'cmd'> & { readonly cmd?: number } : never;

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
export const lastCmd = (log: EventLog<DomainEvent>): number => log.events.at(-1)?.cmd ?? 0;

/** Sequence one command's drafts onto the log (they share a fresh `cmd`). Returns the new log and the appended events. */
export function append<E extends DomainEvent>(
  log: EventLog<E>,
  drafts: readonly EventDraft<E>[],
  at?: string,
): { log: EventLog<E>; appended: E[] } {
  let seq = lastSeq(log);
  const cmd = lastCmd(log) + 1;
  const appended = drafts.map((d) => ({ seq: ++seq, cmd, type: d.type, ...(at === undefined ? {} : { at }), payload: d.payload }) as unknown as E);
  return { log: { events: [...log.events, ...appended] }, appended };
}

/** Truncate the log *to* `seq`: keeps events with `e.seq <= seq` (`truncate(log, 0)` empties it). */
export function truncate<E extends DomainEvent>(log: EventLog<E>, seq: number): EventLog<E> {
  return { events: log.events.filter((e) => e.seq <= seq) };
}

/** Remove every event of the last command. */
export function undo<E extends DomainEvent>(log: EventLog<E>): EventLog<E> {
  const cmd = lastCmd(log);
  return { events: log.events.filter((e) => e.cmd !== cmd) };
}

/** Fold events over an initial state. */
export function replay<S, E>(init: S, events: readonly E[], reducer: Reducer<S, E>): S {
  return events.reduce(reducer, init);
}

/**
 * Upgrade a persisted log: events without `cmd` become their own command (lazy back-compat).
 * Fails on non-contiguous `seq` or a decreasing `cmd`.
 */
export function normalizeLog<E extends DomainEvent>(events: readonly StoredEvent<E>[]): { ok: true; events: E[] } | { ok: false; error: string } {
  const out: E[] = [];
  let prev = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.seq !== i + 1) return { ok: false, error: `Event at index ${i} has seq ${e.seq}, expected ${i + 1}` };
    const cmd = e.cmd ?? prev + 1;
    if (!Number.isInteger(cmd) || cmd < prev || cmd < 1) return { ok: false, error: `Event ${e.seq} has cmd ${cmd}, after cmd ${prev}` };
    out.push({ ...e, cmd } as unknown as E);
    prev = cmd;
  }
  return { ok: true, events: out };
}
