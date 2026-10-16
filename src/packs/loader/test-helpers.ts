// Test-only helpers (not exported from the barrel).
import demo from '../schema/__fixtures__/demo-pack.json';
import other from './__fixtures__/other-demo-pack.json';
import expansion from './__fixtures__/expansion-pack.json';
import type { LoadError, Result } from './errors';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = Record<string, any>;
export const fixtures = () => ({
  demo: structuredClone(demo) as Json,
  other: structuredClone(other) as Json,
  expansion: structuredClone(expansion) as Json,
});

export const errorsOf = <T>(r: Result<T, LoadError[]>): LoadError[] => {
  if (r.ok) throw new Error('expected failure');
  return r.error;
};
export const valueOf = <T>(r: Result<T, LoadError[]>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error, null, 2));
  return r.value;
};
