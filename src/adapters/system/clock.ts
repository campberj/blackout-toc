import type { Clock } from '../../ports';

export const systemClock: Clock = { now: () => new Date() };

/** Deterministic clock for tests: starts at `start`, advances `stepMs` per call. */
export function fixedClock(start: string | Date, stepMs = 0): Clock {
  let t = new Date(start).getTime();
  return {
    now() {
      const d = new Date(t);
      t += stepMs;
      return d;
    },
  };
}
