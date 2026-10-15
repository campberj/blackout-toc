import { describe, it, expect } from 'vitest';
import { createRng, weightedPick } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42), b = createRng(42);
    expect([a.die(10), a.die(10), a.die(10)]).toEqual([b.die(10), b.die(10), b.die(10)]);
  });
  it('resumes from persisted state', () => {
    const a = createRng(7); a.next();
    const b = createRng(a.state);
    expect(b.next()).toBe(a.next());
  });
  it('dice stay in range', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) { const d = r.die(10); expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(10); }
  });
  it('weightedPick respects zero-probability exclusion', () => {
    const r = createRng(3);
    const picks = new Set(Array.from({ length: 200 }, () => weightedPick(r, [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }]).id));
    expect(picks).toEqual(new Set(['a', 'b']));
  });
  it('rejects invalid dice', () => expect(() => createRng(1).die(0)).toThrow());
});
