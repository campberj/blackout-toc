import type { AarField, Campaign, Mission, Scalar } from '$lib/packs/schema';
import { activeOperators, missionDef, type AarInput, type CampaignState } from '$lib/domain/campaign';
import type { AarPrefill, OperatorObservation } from '$lib/app';

// AAR form model ↔ resolveAar command. The form keeps loose values (blank = unset); toAarInput emits
// only what the player set so the engine applies pack defaults for the rest.

/** Recorded by the engine itself; a same-keyed pack field is folded into the row's own control. */
export const ENGINE_AAR_KEYS = ['participated', 'kills'] as const;
const isEngineKey = (k: string) => (ENGINE_AAR_KEYS as readonly string[]).includes(k);

export type FieldValue = Scalar | undefined;

export interface AarOperatorDraft {
  participated: boolean;
  kills: number;
  fields: Record<string, FieldValue>;
  notes: string;
  /** What the dashboard saw at the table (hint only). */
  observed: OperatorObservation['status'] | null;
}

export interface AarDraft {
  mission: string;
  outcome: string;
  fields: Record<string, FieldValue>;
  operators: Record<string, AarOperatorDraft>;
  notes: string;
  /** True when a linked dashboard session pre-filled the form. */
  prefilled: boolean;
  rounds: number | null;
}

export interface AarFieldSets {
  mission: AarField[];
  /** Operator-scope fields the player fills (engine keys removed). */
  operator: AarField[];
  /** Pack help for the engine-recorded columns, when the pack documents them. */
  help: { participated: string | null; kills: string | null };
}

export function aarFieldSets(def: Mission): AarFieldSets {
  const op = def.aar.fields.filter((f) => f.scope === 'operator');
  const help = (k: string) => op.find((f) => f.key === k)?.help ?? null;
  return {
    mission: def.aar.fields.filter((f) => f.scope === 'mission'),
    operator: op.filter((f) => !isEngineKey(f.key)),
    help: { participated: help('participated'), kills: help('kills') },
  };
}

/** Initial control value: pack default, false for booleans, blank otherwise. */
export const initialValue = (f: Pick<AarField, 'kind' | 'default'>): FieldValue => f.default ?? (f.kind === 'boolean' ? false : undefined);

const defaults = (fields: readonly AarField[]) => Object.fromEntries(fields.map((f) => [f.key, initialValue(f)]));

/** Heuristic: the field where an observed casualty status is a useful hint. */
export const isCasualtyField = (f: Pick<AarField, 'key' | 'label' | 'kind'>): boolean =>
  f.kind === 'choice' && /casualt|injur|wound|damage|status/i.test(`${f.key} ${f.label}`);

export interface InitAarOptions {
  /** Operator keys chosen on the briefing screen. */
  selected?: readonly string[];
  prefill?: AarPrefill | undefined;
}

export function initAarDraft(campaign: Campaign, s: CampaignState, mission: string, opts: InitAarOptions = {}): AarDraft | null {
  const def = missionDef(campaign, s, mission);
  if (!def) return null;
  const sets = aarFieldSets(def);
  const pre = opts.prefill;
  const operators: Record<string, AarOperatorDraft> = {};
  for (const op of activeOperators(s)) {
    const seen = pre?.operators[op.key];
    operators[op.key] = {
      participated: seen?.participated ?? opts.selected?.includes(op.key) ?? false,
      kills: seen?.kills ?? 0,
      fields: defaults(sets.operator),
      notes: '',
      observed: seen?.status ?? null,
    };
  }
  const outcome = pre?.outcome && def.outcomes.some((o) => o.key === pre.outcome) ? pre.outcome : '';
  return { mission, outcome, fields: defaults(sets.mission), operators, notes: pre?.notes ?? '', prefilled: !!pre, rounds: pre?.rounds ?? null };
}

const setValues = (fields: Record<string, FieldValue>): Record<string, Scalar> =>
  Object.fromEntries(Object.entries(fields).filter((e): e is [string, Scalar] => e[1] !== undefined && e[1] !== ''));

/** Draft → resolveAar payload. Non-participants are listed (participated:false) but carry no fields. */
export function toAarInput(draft: AarDraft): AarInput {
  const operators: NonNullable<AarInput['operators']> = {};
  for (const [k, o] of Object.entries(draft.operators)) {
    const notes = o.notes.trim();
    operators[k] = o.participated
      ? { participated: true, kills: Math.max(0, Math.floor(o.kills)), fields: setValues(o.fields), ...(notes ? { notes } : {}) }
      : { participated: false, kills: 0, fields: {} };
  }
  const notes = draft.notes.trim();
  return { mission: draft.mission, outcome: draft.outcome, fields: setValues(draft.fields), operators, ...(notes ? { notes } : {}) };
}

/** Form-level checks before asking the engine (it re-validates everything). */
export function validateAarDraft(def: Mission, draft: AarDraft): string[] {
  const out: string[] = [];
  if (!def.outcomes.some((o) => o.key === draft.outcome)) out.push('Pick an outcome.');
  if (!Object.values(draft.operators).some((o) => o.participated)) out.push('Mark at least one operator as deployed.');
  const range = (f: AarField, v: FieldValue, who: string) => {
    if (f.kind !== 'number' || typeof v !== 'number') return;
    if (f.min !== undefined && v < f.min) out.push(`${who}${f.label}: minimum ${f.min}.`);
    if (f.max !== undefined && v > f.max) out.push(`${who}${f.label}: maximum ${f.max}.`);
  };
  const sets = aarFieldSets(def);
  for (const f of sets.mission) range(f, draft.fields[f.key], '');
  for (const o of Object.values(draft.operators)) if (o.participated) for (const f of sets.operator) range(f, o.fields[f.key], '');
  return [...new Set(out)];
}

/** Parse a number input's text (blank → unset). */
export function parseNumber(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}
