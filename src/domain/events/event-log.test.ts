import { describe, expect, it } from 'vitest';
import { append, createEventStore, emptyLog, lastCmd, lastSeq, normalizeLog, replay, truncate, undo, type DomainEvent } from './index';

type Ev = DomainEvent<'Added', { n: number }> | DomainEvent<'Reset', Record<string, never>>;
type Cmd = { type: 'add'; n: number } | { type: 'reset' };

const reduce = (s: number, e: Ev) => (e.type === 'Added' ? s + e.payload.n : 0);
const store = () =>
  createEventStore<number, Cmd, Ev>({
    init: 0,
    reduce,
    decide: (s, c) =>
      c.type === 'reset'
        ? { ok: true, events: [{ type: 'Reset', payload: {} }] }
        : c.n <= 0
          ? { ok: false, error: 'n must be positive' }
          : { ok: true, events: [{ type: 'Added', payload: { n: c.n } }, ...(s + c.n > 10 ? [{ type: 'Reset' as const, payload: {} }] : [])] },
  });

describe('event log', () => {
  it('appends with contiguous seq, a shared cmd per append, and optional timestamp', () => {
    const a = append(emptyLog<Ev>(), [{ type: 'Added', payload: { n: 1 } }]);
    const b = append(a.log, [{ type: 'Added', payload: { n: 2 } }, { type: 'Reset', payload: {} }], '2026-10-15T00:00:00Z');
    expect(b.log.events.map((e) => [e.seq, e.cmd])).toEqual([[1, 1], [2, 2], [3, 2]]);
    expect(a.log.events[0]).not.toHaveProperty('at');
    expect(b.appended[0]!.at).toBe('2026-10-15T00:00:00Z');
    expect([lastSeq(b.log), lastCmd(b.log), lastSeq(emptyLog()), lastCmd(emptyLog())]).toEqual([3, 2, 0, 0]);
  });

  it('undo removes the last command; truncate keeps seq <= n; replay folds', () => {
    let log = emptyLog<Ev>();
    log = append(log, [{ type: 'Added', payload: { n: 1 } }]).log;
    log = append(log, [2, 3].map((n) => ({ type: 'Added' as const, payload: { n } }))).log;
    expect(replay(0, log.events, reduce)).toBe(6);
    expect(undo(log).events.map((e) => e.seq)).toEqual([1]);
    expect(undo(emptyLog<Ev>()).events).toEqual([]);
    expect(truncate(log, 2).events.map((e) => e.seq)).toEqual([1, 2]);
    expect(truncate(log, 0).events).toEqual([]);
  });

  it('normalizes legacy logs (no cmd → one command per event) and rejects malformed ones', () => {
    const legacy = [
      { seq: 1, type: 'Added', payload: { n: 1 } },
      { seq: 2, type: 'Added', payload: { n: 2 } },
      { seq: 3, cmd: 5, type: 'Added', payload: { n: 3 } },
      { seq: 4, cmd: 5, type: 'Reset', payload: {} },
      { seq: 5, type: 'Added', payload: { n: 4 } },
    ] as never[];
    const n = normalizeLog<Ev>(legacy);
    expect(n.ok && n.events.map((e) => e.cmd)).toEqual([1, 2, 5, 5, 6]);
    expect(normalizeLog([{ seq: 2, type: 'x', payload: null }] as never[])).toMatchObject({ ok: false, error: expect.stringMatching(/expected 1/) });
    expect(normalizeLog([{ seq: 1, cmd: 3, type: 'x', payload: null }, { seq: 2, cmd: 2, type: 'x', payload: null }] as never[])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/cmd 2, after cmd 3/),
    });
  });
});

describe('event store', () => {
  it('dispatches, rejects without side effects, previews, undoes per command, truncates, loads', () => {
    const s = store();
    expect(s.dispatch({ type: 'add', n: 4 }, { at: 't1' })).toMatchObject({ ok: true, state: 4 });
    expect(s.dispatch({ type: 'add', n: -1 })).toEqual({ ok: false, error: 'n must be positive' });
    expect(s.events).toHaveLength(1);
    expect(s.preview({ type: 'add', n: 3 })).toMatchObject({ ok: true, state: 7 });
    expect(s.preview({ type: 'add', n: 0 }).ok).toBe(false);
    expect(s.state).toBe(4);
    const r = s.dispatch({ type: 'add', n: 9 }); // one command → Added + Reset
    expect(r.ok && r.events.map((e) => [e.type, e.cmd])).toEqual([['Added', 2], ['Reset', 2]]);
    expect(s.state).toBe(0);
    expect(s.undo()).toBe(4); // both events of command 2 go
    expect(s.events.map((e) => e.seq)).toEqual([1]);
    s.dispatch({ type: 'add', n: 9 });
    expect(s.truncate(2)).toBe(13);
    const events = [...s.events];
    const t = store();
    expect(t.load(events)).toEqual({ ok: true, state: 13 });
    expect(t.load([{ ...events[1]!, seq: 5 }]).ok).toBe(false);
    expect(t.state).toBe(13);
    // Legacy events (no cmd): each undo removes one event.
    const legacy = events.map(({ cmd: _c, ...e }) => e); // eslint-disable-line @typescript-eslint/no-unused-vars
    t.load(legacy);
    expect(t.undo()).toBe(4);
    t.dispatch({ type: 'add', n: 1 });
    expect(t.events.map((e) => e.cmd)).toEqual([1, 2]);
  });
});
