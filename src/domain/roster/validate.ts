import type { ContentLookup } from '../content';
import type { Count, Id, RosterMode, UnitCard } from '$lib/packs/schema';
import { describeCount, issue, matchesSelector, outsideCount, type ValidationIssue } from '../rules';
import type { Roster } from './roster';

// Roster validation against the ruleset's data-driven rosterModes (DESIGN §4). Pure.

interface Member {
  unit: UnitCard;
  path: string;
}

export function validateRoster(r: Roster, lookup: ContentLookup): ValidationIssue[] {
  const ruleset = lookup.get('ruleset', r.rulesetId);
  if (!ruleset) return [issue('error', 'rulesetId', 'unresolved', `Ruleset "${r.rulesetId}" is not loaded`)];
  const mode = ruleset.rosterModes.find((m) => m.mode === r.mode);
  if (!mode) return [issue('error', 'mode', 'mode_unavailable', `${ruleset.name} has no "${r.mode}" roster mode`)];

  const out: ValidationIssue[] = [];
  const count = (n: number, c: Count, path: string, what: string, key?: string) => {
    if (outsideCount(n, c)) out.push(issue('error', path, 'count', `${mode.name}: ${describeCount(c)} ${what} required (has ${n})`, key));
  };
  const resolve = (id: Id, path: string): UnitCard | undefined => {
    const u = lookup.get('unit', id);
    if (!u) out.push(issue('error', path, 'unresolved', `Unit "${id}" is not loaded`));
    return u;
  };
  const typed = (id: Id | undefined, path: string, type: 'handler' | 'duster'): Member | undefined => {
    if (id === undefined) return undefined;
    const unit = resolve(id, path);
    if (!unit) return undefined;
    if (unit.type !== type) out.push(issue('error', path, 'wrong_type', `${unit.name} is not a ${type}`));
    return { unit, path };
  };

  count(r.groups.length, mode.groups, 'groups', 'group(s)');
  const handler = typed(r.handlerId, 'handlerId', 'handler');
  const duster = typed(r.dusterId, 'dusterId', 'duster');

  const everyone: Member[] = [];
  let dusters = duster ? 1 : 0;
  r.groups.forEach((g, gi) => {
    const base = `groups.${gi}`;
    count(g.forceCardId ? 1 : 0, mode.forceCardsPerGroup, `${base}.forceCardId`, 'force card(s) per group');
    if (g.forceCardId && !lookup.get('force', g.forceCardId))
      out.push(issue('error', `${base}.forceCardId`, 'unresolved', `Force card "${g.forceCardId}" is not loaded`));

    const members: Member[] = [];
    const seen = new Set<string>();
    g.unitIds.forEach((id, ui) => {
      const path = `${base}.unitIds.${ui}`;
      const unit = resolve(id, path);
      if (!unit) return;
      if (mode.allowedUnitTypes && !mode.allowedUnitTypes.includes(unit.type))
        out.push(issue('error', path, 'type_not_allowed', `${mode.name} does not allow ${unit.type} units`));
      if (mode.distinctUnitsPerGroup && seen.has(id)) out.push(issue('error', path, 'duplicate', `${unit.name} is already in this group`));
      seen.add(id);
      members.push({ unit, path });
    });
    if (gi === 0) members.push(...[handler, duster].filter((m): m is Member => m !== undefined));

    const of = (t: UnitCard['type']) => members.filter((m) => m.unit.type === t).length;
    const groupDusters = of('duster');
    dusters += groupDusters - (gi === 0 && duster ? 1 : 0);
    const units = members.length - of('handler') - groupDusters + (mode.dusters.replacesUnit ? groupDusters : 0);
    count(units, mode.unitsPerGroup, `${base}.unitIds`, 'unit(s) per group');
    count(of('handler'), mode.handlersPerGroup, gi === 0 && !r.handlerId ? 'handlerId' : `${base}.unitIds`, 'handler(s) per group');
    out.push(...limits(mode, 'group', members, base));
    everyone.push(...members);
  });
  if (dusters > mode.dusters.max)
    out.push(issue('error', 'dusterId', 'count', `${mode.name}: ${describeCount({ max: mode.dusters.max })} duster(s) allowed (has ${dusters})`));
  out.push(...limits(mode, 'roster', everyone, ''));
  return out;
}

function limits(mode: RosterMode, scope: 'group' | 'roster', members: readonly Member[], path: string): ValidationIssue[] {
  return mode.limits
    .filter((l) => l.scope === scope)
    .flatMap((l) => {
      const n = members.filter((m) => matchesSelector(m.unit, l.select)).length;
      return outsideCount(n, l.count) ? [issue('error', path, 'limit', l.message, l.key)] : [];
    });
}
