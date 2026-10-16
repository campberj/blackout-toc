import type { z } from 'zod';

import { err, ok, type Result } from '../../domain/result';
export { err, ok, type Result };

export const LOAD_ERROR_CODES = [
  'json_syntax',
  'schema',
  'duplicate_pack',
  'missing_dependency',
  'dependency_version',
  'invalid_range',
  'dependency_cycle',
  'undeclared_dependency',
  'errata_target_missing',
  'errata_invalid',
  'duplicate_id',
  'unresolved_ref',
  'unresolved_key',
  'invalid_value',
] as const;
export type LoadErrorCode = (typeof LOAD_ERROR_CODES)[number];

export interface LoadError {
  readonly packId?: string;
  /** RFC 6901 JSON pointer into the pack source ('' = whole document). */
  readonly path: string;
  readonly code: LoadErrorCode;
  readonly message: string;
}

export type Path = readonly (string | number)[];

const esc = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
export const pointer = (path: readonly PropertyKey[]): string => path.map((p) => '/' + esc(String(p))).join('');

export const loadError = (code: LoadErrorCode, path: readonly PropertyKey[], message: string, packId?: string): LoadError =>
  packId === undefined ? { code, path: pointer(path), message } : { packId, code, path: pointer(path), message };

/** Map Zod issues to LoadErrors; `prefix` re-roots issue paths (e.g. errata re-validation). */
export const fromZod = (error: z.ZodError, packId?: string, prefix: Path = [], code: LoadErrorCode = 'schema'): LoadError[] =>
  error.issues.map((i) => loadError(code, [...prefix, ...i.path], i.message, packId));

/** Stable de-duplication (same pack + path + code reported by two passes). */
export const dedupe = (errors: readonly LoadError[]): LoadError[] => {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const k = `${e.packId ?? ''}\u0000${e.path}\u0000${e.code}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
