import { BUILTIN_STATS } from '../schema';
import { Campaign, type Condition, type Effect, Key, NarrativeRef, type Pack, Table } from '../schema';
import type { Campaign as CampaignT, Table as TableT } from '../schema';
import { packOf } from './content-kinds';
import type { ContentIndex } from './errata';
import { loadError, type LoadError, type LoadErrorCode, type Path } from './errors';
import { collectRefs } from './namespace';
import { walkDslIn } from './dsl-walk';
import { traverse } from './traverse';

type Report = (code: LoadErrorCode, path: Path, message: string) => void;

// ── Cross-pack refs ──────────────────────────────────────────────────────

/** Every Ref resolves to an id of the right kind, in this pack or a declared (transitive) dependency. */
export function validateRefs(pack: Pack, deps: ReadonlySet<string>, loaded: ReadonlySet<string>, idx: ContentIndex): LoadError[] {
  const errors: LoadError[] = [];
  for (const site of collectRefs(pack)) {
    const owner = packOf(site.ref);
    const report = (code: LoadErrorCode, msg: string) => errors.push(loadError(code, site.path, msg, pack.id));
    if (owner !== pack.id && !deps.has(owner)) {
      if (loaded.has(owner)) report('undeclared_dependency', `"${site.ref}" is in pack "${owner}", which "${pack.id}" does not require`);
      else report(site.errataTarget ? 'errata_target_missing' : 'unresolved_ref', `"${site.ref}": pack "${owner}" is not loaded`);
    } else if (!idx.get(site.kind)!.has(site.ref)) {
      if (site.errataTarget) report('errata_target_missing', `Errata targets unknown ${site.kind} "${site.ref}"`);
      else report('unresolved_ref', `Unknown ${site.kind} "${site.ref}"`);
    }
  }
  return errors;
}

// ── Campaign-internal keys ───────────────────────────────────────────────


interface CampaignKeys {
  missions: Map<string, Set<string>>; // mission → outcome keys
  stages: Set<string>;
  ladders: Map<string, Set<string>>; // ladder → state keys
  pools: Set<string>;
  tracks: Map<string, { min: number; max: number; milestones: Set<string> }>;
  stats: Set<string>;
  personas: Set<string>;
  narratives: Set<string>;
  ranks: Set<string>;
  teams: Set<string>;
  operators: Set<string>;
  assets: Set<string>;
  outcomes: Set<string>; // union, for missionOutcome without mission
}

const keys = <T extends { key: string }>(xs: readonly T[]) => new Set(xs.map((x) => x.key));

function campaignKeys(c: CampaignT): CampaignKeys {
  const teams = keys(c.roster.startingTeams);
  const operators = new Set(c.roster.startingTeams.flatMap((t) => t.operators.flatMap((o) => (o.key ? [o.key] : []))));
  // Teams/operators can also be introduced by effects.
  walkDslIn(Campaign, c, {
    effect(e) {
      if (e.op === 'addTeam') {
        teams.add(e.team.key);
        e.team.operators.forEach((o) => o.key && operators.add(o.key));
      } else if (e.op === 'addOperator' && e.operator.key) operators.add(e.operator.key);
    },
  });
  return {
    missions: new Map(c.missions.map((m) => [m.key, keys(m.outcomes)])),
    stages: keys(c.timeline.stages),
    ladders: new Map(c.ladders.map((l) => [l.key, keys(l.states)])),
    pools: keys(c.pools),
    tracks: new Map(c.tracks.map((t) => [t.key, { min: t.min, max: t.max, milestones: keys(t.milestones) }])),
    stats: new Set([...BUILTIN_STATS, ...c.roster.stats.map((s) => s.key)]),
    personas: keys(c.personas),
    narratives: keys(c.narratives),
    ranks: keys(c.roster.ranks),
    teams,
    operators,
    assets: keys(c.assets),
    outcomes: new Set(c.missions.flatMap((m) => m.outcomes.map((o) => o.key))),
  };
}

function keyChecker(k: CampaignKeys, report: Report, ctx: string) {
  const need = (set: { has(k: string): boolean } | undefined, what: string, key: string | undefined, path: Path) => {
    if (key !== undefined && !set?.has(key)) report('unresolved_key', path, `Unknown ${what} "${key}"${ctx}`);
  };
  const target = (t: string | undefined, path: Path) => {
    if (t?.startsWith('team:')) need(k.teams, 'team', t.slice(5), path);
    else if (t?.startsWith('operator:')) need(k.operators, 'operator', t.slice(9), path);
  };
  const ladder = (name: string, states: readonly string[], path: Path, statePath: (i: number) => Path) => {
    need(k.ladders, 'ladder', name, [...path, 'ladder']);
    const ls = k.ladders.get(name);
    if (ls) states.forEach((s, i) => need(ls, `state of ladder "${name}"`, s, statePath(i)));
  };

  const condition = (c: Condition, p: Path) => {
    switch (c.op) {
      case 'trackGte': {
        need(k.tracks, 'track', c.track, [...p, 'track']);
        const t = k.tracks.get(c.track);
        if (t && (c.value < t.min || c.value > t.max))
          report('invalid_value', [...p, 'value'], `trackGte ${c.value} is outside track "${c.track}" range ${t.min}..${t.max}${ctx}`);
        break;
      }
      case 'poolGte':
        return need(k.pools, 'pool', c.pool, [...p, 'pool']);
      case 'missionOutcome': {
        need(k.missions, 'mission', c.mission, [...p, 'mission']);
        const outs = c.mission === undefined ? k.outcomes : k.missions.get(c.mission);
        if (outs) c.outcomes.forEach((o, i) => need(outs, 'mission outcome', o, [...p, 'outcomes', i]));
        break;
      }
      case 'ladderIs':
        target(c.target, [...p, 'target']);
        return ladder(c.ladder, c.states, p, (i) => [...p, 'states', i]);
      case 'operatorStat':
        target(c.target, [...p, 'target']);
        return need(k.stats, 'stat', c.stat, [...p, 'stat']);
      case 'stageIs':
        return need(k.stages, 'stage', c.stage, [...p, 'stage']);
    }
  };

  const effect = (e: Effect, p: Path) => {
    if ('target' in e && typeof e.target === 'string') target(e.target, [...p, 'target']);
    switch (e.op) {
      case 'stepLadder':
        return ladder(e.ladder, [], p, () => p);
      case 'setLadder':
        return ladder(e.ladder, [e.state], p, () => [...p, 'state']);
      case 'adjustPool':
        return need(k.pools, 'pool', e.pool, [...p, 'pool']);
      case 'adjustTrack':
        return need(k.tracks, 'track', e.track, [...p, 'track']);
      case 'addOperator':
        return need(k.teams, 'team', e.team, [...p, 'team']);
      case 'unlockMission':
        need(k.missions, 'mission', e.mission, [...p, 'mission']);
        return need(k.stages, 'stage', e.stage, [...p, 'stage']);
      case 'lockMission':
        return need(k.missions, 'mission', e.mission, [...p, 'mission']);
      case 'grantAsset':
        need(k.assets, 'asset', e.asset, [...p, 'asset']);
        return need(k.teams, 'team', e.team, [...p, 'team']);
      case 'promote':
        return need(k.ranks, 'rank', e.rank, [...p, 'rank']);
      case 'adjustStat':
        return need(k.stats, 'stat', e.stat, [...p, 'stat']);
    }
  };

  /** Narrative refs and speakers anywhere under `value` (found via schema + field name). */
  const narratives = (schema: typeof Campaign | typeof Table, value: unknown, root: Path) =>
    traverse(
      schema,
      value,
      (n) => {
        if (n.schema === NarrativeRef && typeof n.value === 'string') need(k.narratives, 'narrative', n.value, n.path);
        else if (n.field === 'speaker' && n.schema === Key && typeof n.value === 'string') need(k.personas, 'persona', n.value, n.path);
      },
      root,
    );

  return { need, condition, effect, narratives };
}

/** Tables reachable from a campaign (nameTable + rollTable, transitively through table entries). */
function reachableTables(c: CampaignT, idx: ContentIndex): TableT[] {
  const tables = idx.get('table')! as Map<string, TableT>;
  const seen = new Set<string>();
  const queue: string[] = c.roster.nameTable ? [c.roster.nameTable] : [];
  const collect = { effect: (e: Effect) => void (e.op === 'rollTable' && queue.push(e.table)) };
  walkDslIn(Campaign, c, collect);
  const out: TableT[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const t = tables.get(id);
    if (seen.has(id) || !t) continue; // missing → reported by validateRefs
    seen.add(id);
    out.push(t);
    walkDslIn(Table, t, collect);
  }
  return out;
}

/** Locate a content item's pack + array index for error paths. */
export type Locate = (kind: 'table', id: string) => { packId: string; path: Path } | undefined;

/** Campaign-internal key resolution, incl. shared tables evaluated in each rolling campaign's context. */
export function validateCampaign(pack: Pack, ci: number, idx: ContentIndex, locate: Locate): LoadError[] {
  const c = pack.content.campaigns[ci]!;
  const root: Path = ['content', 'campaigns', ci];
  const errors: LoadError[] = [];
  const k = campaignKeys(c);
  const reportIn =
    (packId: string): Report =>
    (code, path, message) =>
      errors.push(loadError(code, path, message, packId));

  const own = keyChecker(k, reportIn(pack.id), '');
  walkDslIn(Campaign, c, { effect: own.effect, condition: own.condition }, root);
  own.narratives(Campaign, c, root);

  // Non-DSL key sites.
  c.timeline.stages.forEach((s, si) =>
    s.slots.forEach((sl, li) =>
      sl.missions.forEach((m, mi) => own.need(k.missions, 'mission', m, [...root, 'timeline', 'stages', si, 'slots', li, 'missions', mi])),
    ),
  );
  c.triggers.forEach((t, ti) => {
    const p = [...root, 'triggers', ti, 'filter'];
    const f = t.filter;
    if (!f) return;
    own.need(k.stages, 'stage', f.stage, [...p, 'stage']);
    own.need(k.missions, 'mission', f.mission, [...p, 'mission']);
    own.need(k.tracks, 'track', f.track, [...p, 'track']);
    if (f.milestone !== undefined) {
      const tracks = f.track !== undefined ? [k.tracks.get(f.track)] : [...k.tracks.values()];
      if (!tracks.some((tr) => tr?.milestones.has(f.milestone!)))
        own.need(undefined, 'milestone', f.milestone, [...p, 'milestone']);
    }
  });
  c.missions.forEach((m, mi) =>
    m.aar.fields.forEach((f, fi) => {
      const p = [...root, 'missions', mi, 'aar', 'fields', fi];
      const bad = (path: Path, msg: string) => errors.push(loadError('invalid_value', path, msg, pack.id));
      if (f.perUnit.length && f.kind !== 'number') bad([...p, 'perUnit'], `perUnit requires kind 'number' (field "${f.key}" is '${f.kind}')`);
      f.onValue.forEach((ov, vi) => {
        const vp = [...p, 'onValue', vi, 'value'];
        if (f.kind === 'choice' && !f.options?.some((o) => o.value === ov.value)) bad(vp, `"${String(ov.value)}" is not an option of "${f.key}"`);
        else if (f.kind === 'boolean' && typeof ov.value !== 'boolean') bad(vp, `Field "${f.key}" expects a boolean`);
        else if (f.kind === 'number' && typeof ov.value !== 'number') bad(vp, `Field "${f.key}" expects a number`);
      });
    }),
  );

  // Shared tables: their effects/speakers must make sense in every campaign that rolls them.
  for (const t of reachableTables(c, idx)) {
    const loc = locate('table', t.id)!;
    const chk = keyChecker(k, reportIn(loc.packId), ` (table rolled by campaign "${c.id}")`);
    walkDslIn(Table, t, { effect: chk.effect, condition: chk.condition }, loc.path);
    chk.narratives(Table, t, loc.path);
  }
  return errors;
}
