/** Seeded PRNG (mulberry32). All domain randomness MUST flow through this for replayable state. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [1, sides]. */
  die(sides: number): number;
  /** Current internal state, persist to resume the stream. */
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    die: (sides) => {
      if (!Number.isInteger(sides) || sides < 1) throw new RangeError(`Invalid die: d${sides}`);
      return 1 + Math.floor(next() * sides);
    },
    get state() {
      return s;
    },
  };
}

/** Pick from weighted entries. Weights must be positive integers. */
export function weightedPick<T extends { weight: number }>(rng: Rng, entries: readonly T[]): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) throw new RangeError('weightedPick: no positive weights');
  let roll = rng.next() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll < 0) return e;
  }
  return entries[entries.length - 1]!;
}
