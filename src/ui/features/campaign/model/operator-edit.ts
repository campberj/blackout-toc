import { Name, type Scalar } from '$lib/packs/schema';
import type { CampaignCommandInput, OperatorState } from '$lib/domain/campaign';

// Operator sheet edit → updateOperator carrying only what changed.

export interface OperatorEditDraft {
  name: string;
  callsign: string;
  fields: Record<string, Scalar>;
}

export function operatorEdit(op: OperatorState, d: OperatorEditDraft): { command: Extract<CampaignCommandInput, { type: 'updateOperator' }> | null; problem: string | null } {
  const name = d.name.trim();
  const callsign = d.callsign.trim();
  const changedFields = Object.fromEntries(Object.entries(d.fields).filter(([k, v]) => op.fields[k] !== v));
  const nameChanged = name !== op.name;
  const callChanged = (callsign || null) !== op.callsign;
  if (!nameChanged && !callChanged && !Object.keys(changedFields).length) return { command: null, problem: null };
  const problem = Name.safeParse(name).success ? null : 'Name is required (80 characters at most).';
  return {
    command: {
      type: 'updateOperator',
      operator: op.key,
      ...(nameChanged ? { name } : {}),
      ...(callChanged ? { callsign: callsign || null } : {}),
      ...(Object.keys(changedFields).length ? { fields: changedFields } : {}),
    },
    problem,
  };
}
