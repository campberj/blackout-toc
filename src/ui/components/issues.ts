import type { ValidationIssue } from '../../app';

// Map dotted validation paths onto form fields (shared by roster builder + forge).

/** Issues whose path is exactly `path`. */
export const issuesAt = (issues: readonly ValidationIssue[], path: string): ValidationIssue[] => issues.filter((i) => i.path === path);

/** First message at `path` (errors before warnings), for a Field's `error` slot. */
export function fieldMessage(issues: readonly ValidationIssue[], path: string): string | undefined {
  const at = issuesAt(issues, path);
  return (at.find((i) => i.severity === 'error') ?? at[0])?.message;
}

/** Issues no field claims (shown in the summary list). */
export const unclaimed = (issues: readonly ValidationIssue[], claimed: (path: string) => boolean): ValidationIssue[] =>
  issues.filter((i) => !claimed(i.path));

export function splitBySeverity(issues: readonly ValidationIssue[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  return { errors: issues.filter((i) => i.severity === 'error'), warnings: issues.filter((i) => i.severity === 'warning') };
}
