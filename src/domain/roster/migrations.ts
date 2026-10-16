// Pure, ordered migrations for persisted roster records (rosters collection). Never edit a shipped step.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** v1 → v2: one handler per group (RJ ruling). Roster-level `handlerId` moves to `groups[0].handlerId`. */
export function rosterV1toV2(old: unknown): unknown {
  if (!isObj(old) || !('handlerId' in old)) return old;
  const { handlerId, ...rest } = old;
  if (typeof handlerId !== 'string') return rest;
  const groups = Array.isArray(old.groups) ? old.groups.map((g) => (isObj(g) ? { ...g } : g)) : [];
  const first = groups[0];
  if (isObj(first)) {
    if (first.handlerId === undefined) first.handlerId = handlerId;
  } else if (groups.length === 0) groups.push({ unitIds: [], handlerId });
  return { ...rest, groups };
}

/** `ROSTER_MIGRATIONS[i]` upgrades v(i+1) → v(i+2). */
export const ROSTER_MIGRATIONS = [rosterV1toV2] as const;
export const ROSTER_SCHEMA_VERSION = ROSTER_MIGRATIONS.length + 1;
