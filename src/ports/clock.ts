/** Injected so timestamps are deterministic in tests. */
export interface Clock {
  now(): Date;
}
