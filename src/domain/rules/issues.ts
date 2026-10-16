// Field-level validation result shared by Forge (units) and roster validation.

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  readonly severity: IssueSeverity;
  /** Dotted path into the validated value ('' = whole value), e.g. `weapons.0.maxRange`. */
  readonly path: string;
  /** Machine code (`limit`, `calibration`, `outlier`, `unresolved`, `schema`, …). */
  readonly code: string;
  /** FieldCheck / limit key when the issue comes from pack data. */
  readonly key?: string;
  readonly message: string;
}

export const issue = (severity: IssueSeverity, path: string, code: string, message: string, key?: string): ValidationIssue =>
  key === undefined ? { severity, path, code, message } : { severity, path, code, key, message };

export const hasErrors = (issues: readonly ValidationIssue[]): boolean => issues.some((i) => i.severity === 'error');

/** Zod-style path (array) → dotted path. */
export const dotted = (path: readonly PropertyKey[]): string => path.map(String).join('.');
