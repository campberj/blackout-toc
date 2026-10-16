import { Key, REMOVE_REASONS, type Campaign, type Effect } from '$lib/packs/schema';
import type { CampaignState } from '$lib/domain/campaign';

// Small effect editor for custom-mission rewards and GM adjustments: one flat row per effect,
// limited to ops a player can reason about. Rows map 1:1 onto DSL effects.

export type RowOp = 'adjustTrack' | 'adjustPool' | 'grantAsset' | 'addXp' | 'adjustStat' | 'setLadder' | 'promote' | 'removeOperator' | 'setFlag';
export type EditorContext = 'reward' | 'manual';

export interface EffectRow {
  op: RowOp;
  /** Track / pool / asset / ladder / stat / flag key. */
  ref: string;
  target: string;
  amount: number;
  /** Ladder state, removal reason, or flag value. */
  value: string;
}

export interface Option {
  value: string;
  label: string;
}

const OP_LABEL: Record<RowOp, string> = {
  adjustTrack: 'Adjust track',
  adjustPool: 'Adjust pool',
  grantAsset: 'Grant asset',
  addXp: 'Award XP',
  adjustStat: 'Adjust operator stat',
  setLadder: 'Set status',
  promote: 'Promote',
  removeOperator: 'Remove operator',
  setFlag: 'Set flag',
};

const REWARD_OPS: RowOp[] = ['adjustTrack', 'adjustPool', 'grantAsset', 'addXp'];
const MANUAL_OPS: RowOp[] = ['adjustTrack', 'adjustPool', 'grantAsset', 'addXp', 'adjustStat', 'setLadder', 'promote', 'removeOperator', 'setFlag'];

export function refOptions(campaign: Campaign, op: RowOp): Option[] {
  switch (op) {
    case 'adjustTrack':
      return campaign.tracks.map((t) => ({ value: t.key, label: t.name }));
    case 'adjustPool':
      return campaign.pools.map((p) => ({ value: p.key, label: p.name }));
    case 'grantAsset':
      return campaign.assets.map((a) => ({ value: a.key, label: a.name }));
    case 'adjustStat':
      return [
        { value: 'xp', label: 'XP' },
        { value: 'kills', label: 'Kills' },
        { value: 'missions', label: 'Missions' },
        ...campaign.roster.stats.map((st) => ({ value: st.key, label: st.name })),
      ];
    case 'setLadder':
      return campaign.ladders.map((l) => ({ value: l.key, label: l.name }));
    default:
      return [];
  }
}

/** Ops usable here (a campaign without pools gets no pool row, etc.). */
export function effectOps(campaign: Campaign, context: EditorContext): Option[] {
  const needsRef: RowOp[] = ['adjustTrack', 'adjustPool', 'grantAsset', 'setLadder'];
  return (context === 'reward' ? REWARD_OPS : MANUAL_OPS)
    .filter((op) => !needsRef.includes(op) || refOptions(campaign, op).length > 0)
    .map((op) => ({ value: op, label: OP_LABEL[op] }));
}

export function valueOptions(campaign: Campaign, row: EffectRow): Option[] {
  if (row.op === 'setLadder') return campaign.ladders.find((l) => l.key === row.ref)?.states.map((s) => ({ value: s.key, label: s.name })) ?? [];
  if (row.op === 'removeOperator') return REMOVE_REASONS.map((r) => ({ value: r, label: r.toUpperCase() === r ? r : r.charAt(0).toUpperCase() + r.slice(1) }));
  return [];
}

/** Targets: rewards apply to the mission's participants; GM rows can name anyone. */
export function targetOptions(campaign: Campaign, s: CampaignState, context: EditorContext, row?: EffectRow): Option[] {
  if (context === 'reward') return [{ value: 'participants', label: 'Mission participants' }];
  const ladder = row?.op === 'setLadder' ? campaign.ladders.find((l) => l.key === row.ref) : undefined;
  const teams = s.teamOrder.map((k) => ({ value: `team:${k}`, label: s.teams[k]!.name }));
  if (ladder?.scope === 'campaign') return [{ value: '', label: 'Campaign' }];
  if (ladder?.scope === 'team') return teams;
  const ops = s.teamOrder.flatMap((t) =>
    s.teams[t]!.operators.filter((k) => s.operators[k]?.status === 'active').map((k) => ({ value: `operator:${k}`, label: `${s.operators[k]!.name} (${s.teams[t]!.name})` })),
  );
  return [...ops, ...teams.map((t) => ({ ...t, label: `Everyone in ${t.label}` })), { value: 'roster', label: 'Whole roster' }];
}

export function newRow(campaign: Campaign, s: CampaignState, op: RowOp, context: EditorContext): EffectRow {
  const ref = refOptions(campaign, op)[0]?.value ?? '';
  const row: EffectRow = { op, ref, target: '', amount: 1, value: '' };
  row.target = targetOptions(campaign, s, context, row)[0]?.value ?? '';
  row.value = valueOptions(campaign, row)[0]?.value ?? (op === 'setFlag' ? 'true' : '');
  return row;
}

/** Keep dependent fields valid after the op or ref changes. */
export function normalizeRow(campaign: Campaign, s: CampaignState, row: EffectRow, context: EditorContext): EffectRow {
  const refs = refOptions(campaign, row.op);
  const ref = refs.length && !refs.some((r) => r.value === row.ref) ? refs[0]!.value : row.ref;
  const next = { ...row, ref };
  const targets = targetOptions(campaign, s, context, next);
  if (!targets.some((t) => t.value === next.target)) next.target = targets[0]?.value ?? '';
  const values = valueOptions(campaign, next);
  if (values.length && !values.some((v) => v.value === next.value)) next.value = values[0]!.value;
  return next;
}

const flagValue = (v: string): boolean | number | string => (v === 'true' ? true : v === 'false' ? false : v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v);

export function rowToEffect(row: EffectRow): Effect {
  const target = row.target as Extract<Effect, { op: 'addXp' }>['target'];
  const amount = Math.trunc(row.amount);
  switch (row.op) {
    case 'adjustTrack':
      return { op: 'adjustTrack', track: row.ref, amount };
    case 'adjustPool':
      return { op: 'adjustPool', pool: row.ref, amount };
    case 'grantAsset':
      return { op: 'grantAsset', asset: row.ref, count: Math.max(1, amount) };
    case 'addXp':
      return { op: 'addXp', target, amount };
    case 'adjustStat':
      return { op: 'adjustStat', target, stat: row.ref, amount };
    case 'setLadder':
      return { op: 'setLadder', ladder: row.ref, state: row.value, ...(row.target ? { target } : {}) };
    case 'promote':
      return { op: 'promote', target };
    case 'removeOperator':
      return { op: 'removeOperator', target, reason: row.value as (typeof REMOVE_REASONS)[number] };
    case 'setFlag':
      return { op: 'setFlag', flag: row.ref.trim(), value: flagValue(row.value) };
  }
}

/** One-line summary for confirmations. */
export function describeRow(campaign: Campaign, s: CampaignState, row: EffectRow, context: EditorContext): string {
  const ref = refOptions(campaign, row.op).find((r) => r.value === row.ref)?.label ?? row.ref;
  const who = targetOptions(campaign, s, context, row).find((t) => t.value === row.target)?.label ?? row.target;
  const signed = row.amount >= 0 ? `+${row.amount}` : String(row.amount);
  const val = valueOptions(campaign, row).find((v) => v.value === row.value)?.label ?? row.value;
  switch (row.op) {
    case 'adjustTrack':
    case 'adjustPool':
      return `${ref} ${signed}`;
    case 'grantAsset':
      return `Grant ${ref} ×${Math.max(1, row.amount)}`;
    case 'addXp':
      return `${signed} XP: ${who}`;
    case 'adjustStat':
      return `${ref} ${signed}: ${who}`;
    case 'setLadder':
      return `${ref} → ${val}: ${who}`;
    case 'promote':
      return `Promote ${who}`;
    case 'removeOperator':
      return `Remove ${who} (${val})`;
    case 'setFlag':
      return `Flag ${row.ref || '?'} = ${row.value}`;
  }
}

/** Row-level problems (blank flag key, missing target). */
export function rowProblems(row: EffectRow): string | null {
  if (row.op === 'setFlag' && !Key.safeParse(row.ref.trim()).success) return 'Flag key: lowercase letters, digits and single dashes.';
  if (['addXp', 'adjustStat', 'promote', 'removeOperator'].includes(row.op) && !row.target) return 'Pick who this applies to.';
  if (!Number.isFinite(row.amount)) return 'Amount must be a number.';
  return null;
}
