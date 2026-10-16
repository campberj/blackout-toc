import type { FieldDef, Scalar } from '$lib/packs/schema';

/** Engine-recorded per-operator AAR values; a same-named operator-scope pack field reads these instead of asking twice. */
export const ENGINE_AAR_KEYS = ['kills', 'participated'] as const;

type FieldLike = Pick<FieldDef, 'key' | 'kind' | 'options' | 'min' | 'max'>;

/** Validate a value against a typed form field (operator template fields and AAR fields share this). */
export function checkFieldValue(f: FieldLike, v: Scalar): string | undefined {
  switch (f.kind) {
    case 'boolean':
      return typeof v === 'boolean' ? undefined : `${f.key}: expected boolean`;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `${f.key}: expected number`;
      if (f.min !== undefined && v < f.min) return `${f.key}: below minimum ${f.min}`;
      if (f.max !== undefined && v > f.max) return `${f.key}: above maximum ${f.max}`;
      return undefined;
    case 'choice':
      return f.options!.some((o) => o.value === v) ? undefined : `${f.key}: "${String(v)}" is not an option`;
    case 'text':
      return typeof v === 'string' ? undefined : `${f.key}: expected text`;
  }
}

/** Validate a record of values against field defs; unknown keys are errors. */
export function checkFieldRecord(defs: readonly FieldLike[], values: Record<string, Scalar>, what: string): string | undefined {
  for (const [k, v] of Object.entries(values)) {
    const f = defs.find((d) => d.key === k);
    if (!f) return `${what}: unknown field "${k}"`;
    const err = checkFieldValue(f, v);
    if (err) return `${what}: ${err}`;
  }
  return undefined;
}
