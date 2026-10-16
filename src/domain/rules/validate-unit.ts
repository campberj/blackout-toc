import type { CalibrationProfile, FieldCheck, Id, KeywordRef, RulesetProfile, UnitCard, UnitField } from '$lib/packs/schema';
import type { ContentLookup } from '../content';
import { issue, type IssueSeverity, type ValidationIssue } from './issues';
import { matchesSelector } from './selector';
import { fieldValues, violates } from './unit-fields';

// Unit Forge validator (DESIGN §7): ruleset limits → errors; calibration → warnings. Pure.

export interface UnitValidationContext {
  /** Resolves faction/keyword refs; omit to skip reference checks. */
  readonly lookup?: ContentLookup;
  readonly ruleset?: RulesetProfile;
  /** Already filtered with `applicableCalibrations`. */
  readonly calibrations?: readonly CalibrationProfile[];
  /** Official (non-custom) units for percentile outlier checks. */
  readonly population?: readonly UnitCard[];
}

/** Minimum same-type sample size before percentile outliers are meaningful. */
export const OUTLIER_MIN_SAMPLE = 5;

/** Calibrations targeting `rulesetId` (empty `rulesets` = any). */
export const applicableCalibrations = (all: readonly CalibrationProfile[], rulesetId: Id | undefined): CalibrationProfile[] =>
  all.filter((c) => c.rulesets.length === 0 || (rulesetId !== undefined && c.rulesets.includes(rulesetId)));

export function validateUnit(unit: UnitCard, ctx: UnitValidationContext): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (ctx.lookup) out.push(...checkRefs(unit, ctx.lookup));
  if (ctx.ruleset) out.push(...runChecks(unit, ctx.ruleset.unitLimits, 'error', 'limit'));
  for (const cal of ctx.calibrations ?? []) {
    out.push(...runChecks(unit, cal.checks, 'warning', 'calibration'));
    if (cal.outliers && ctx.population) out.push(...outliers(unit, cal.outliers.fields, cal.outliers.percentile, ctx.population));
  }
  return out;
}

function runChecks(unit: UnitCard, checks: readonly FieldCheck[], severity: IssueSeverity, code: string): ValidationIssue[] {
  return checks
    .filter((c) => matchesSelector(unit, c.when))
    .flatMap((c) => fieldValues(unit, c.field).filter((v) => violates(c, v.value)).map((v) => issue(severity, v.path, code, c.message, c.key)));
}

function checkRefs(unit: UnitCard, lookup: ContentLookup): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!lookup.get('faction', unit.faction as Id)) out.push(issue('error', 'faction', 'unresolved', `Faction "${unit.faction}" is not loaded`));
  const kw = (refs: readonly KeywordRef[], base: string) =>
    refs.forEach((r, i) => {
      if (!lookup.get('keyword', r.key as Id)) out.push(issue('error', `${base}.${i}.key`, 'unresolved', `Keyword "${r.key}" is not loaded`));
    });
  kw(unit.keywords, 'keywords');
  unit.weapons.forEach((w, i) => kw(w.keywords, `weapons.${i}.keywords`));
  unit.specialists.forEach((s, si) => {
    kw(s.keywords, `specialists.${si}.keywords`);
    s.weapons.forEach((w, wi) => kw(w.keywords, `specialists.${si}.weapons.${wi}.keywords`));
  });
  return out;
}

/** Nearest-rank percentile of a sorted sample. */
const percentile = (sorted: readonly number[], p: number): number => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;

function outliers(unit: UnitCard, fields: readonly UnitField[], p: number, population: readonly UnitCard[]): ValidationIssue[] {
  const peers = population.filter((u) => u.type === unit.type && u.id !== unit.id);
  if (peers.length < OUTLIER_MIN_SAMPLE) return [];
  return fields.flatMap((field) => {
    const sample = peers.flatMap((u) => fieldValues(u, field).map((v) => v.value)).sort((a, b) => a - b);
    if (sample.length < OUTLIER_MIN_SAMPLE) return [];
    const lo = percentile(sample, p);
    const hi = percentile(sample, 100 - p);
    return fieldValues(unit, field)
      .filter((v) => v.value < lo || v.value > hi)
      .map((v) => issue('warning', v.path, 'outlier', `${field} ${v.value} is outside the typical ${lo}–${hi} for loaded ${unit.type} cards`, field));
  });
}
