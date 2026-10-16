import { describe, expect, it } from 'vitest';
import { append, createEventStore, emptyLog, lastSeq, replay, undo, validateLog, type DomainEvent } from './index';

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
  it('appends with contiguous seq and optional timestamp', () => {
    const a = append(emptyLog<Ev>(), [{ type: 'Added', payload: { n: 1 } }]);
    const b = append(a.log, [{ type: 'Added', payload: { n: 2 } }, { type: 'Reset', payload: {} }], '2026-10-15T00:00:00Z');
    expect(b.log.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(a.log.events[0]).not.toHaveProperty('at');
    expect(b.appended[0]!.at).toBe('2026-10-15T00:00:00Z');
    expect(lastSeq(b.log)).toBe(3);
    expect(lastSeq(emptyLog())).toBe(0);
  });

  it('undo truncates to seq; replay folds', () => {
    const { log } = append(emptyLog<Ev>(), [1, 2, 3].map((n) => ({ type: 'Added' as const, payload: { n } })));
    expect(replay(0, log.events, reduce)).toBe(6);
    expect(undo(log, 2).events.map((e) => e.seq)).toEqual([1, 2]);
    expect(undo(log, 0).events).toEqual([]);
  });

  it('validates seq contiguity', () => {
    expect(validateLog([{ seq: 1, type: 'x', payload: null }])).toBeUndefined();
    expect(validateLog([{ seq: 2, type: 'x', payload: null }])).toMatch(/expected 1/);
  });
});

describe('event store', () => {
  it('dispatches, rejects without side effects, previews, undoes, loads', () => {
    const s = store();
    expect(s.dispatch({ type: 'add', n: 4 }, { at: 't1' })).toMatchObject({ ok: true, state: 4 });
    expect(s.dispatch({ type: 'add', n: -1 })).toEqual({ ok: false, error: 'n must be positive' });
    expect(s.events).toHaveLength(1);
    expect(s.preview({ type: 'add', n: 3 })).toMatchObject({ ok: true, state: 7 });
    expect(s.preview({ type: 'add', n: 0 }).ok).toBe(false);
    expect(s.state).toBe(4);
    const r = s.dispatch({ type: 'add', n: 9 }); // emits Added + Reset
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['Added', 'Reset']);
    expect(s.state).toBe(0);
    expect(s.undo(2)).toBe(13);
    expect(s.events.map((e) => e.seq)).toEqual([1, 2]);
    const events = [...s.events];
    const t = store();
    expect(t.load(events)).toEqual({ ok: true, state: 13 });
    expect(t.load([{ ...events[1]!, seq: 5 }]).ok).toBe(false);
    expect(t.state).toBe(13);
  });
});
