import type { AarField, Effect, Scalar } from '$lib/packs/schema';
import type { ContentLookup } from '../content';
import type { Reducer } from '../events';
import { createRng } from '../rng/rng';
import type { Aar, CampaignEvent, EventPayload } from './commands';
import { passes } from './conditions';
import { emptyScope, log, pushFeed, type Ctx, type Scope } from './context';
import { applyEffects, rollTable } from './effects';
import { emitNarrative, showNarrative } from './narrative';
import { ENGINE_AAR_KEYS } from './fields';
import { createOperator, createTeam, pushHistory } from './roster';
import { missionDef, type CampaignState } from './state';
import { currentStage, slotsComplete } from './timeline';
import { fireTrigger } from './triggers';


/**
 * Build the campaign reducer. Events are intents (one per command); effects are re-interpreted on
 * replay from state + content + rngState, so the reducer is pure given the same pack versions.
 */
export function createCampaignReducer(content: ContentLookup): Reducer<CampaignState, CampaignEvent> {
  return (prev, event) => {
    const s = structuredClone(prev);
    const id = event.type === 'CampaignStarted' ? event.payload.campaign : s.campaign;
    const campaign = id ? content.get('campaign', id) : undefined;
    if (!campaign) {
      // Never throw on a persisted event: surface the environment problem instead.
      pushFeed(s, event.seq, { kind: 'error', text: `Campaign "${id ?? '?'}" is not loaded; event ${event.type} was not applied.`, source: { type: 'engine', key: null } });
      return s;
    }
    const rng = createRng(event.type === 'CampaignStarted' ? event.payload.seed : s.rngState);
    const ctx: Ctx = {
      content,
      campaign,
      s,
      rng,
      seq: event.seq,
      depth: 0,
      steps: 0,
      halted: false,
      fire: (on, info, scope) => fireTrigger(ctx, on, info, scope),
    };
    apply(ctx, event);
    s.rngState = rng.state;
    return s;
  };
}

function apply(ctx: Ctx, e: CampaignEvent): void {
  switch (e.type) {
    case 'CampaignStarted':
      return startCampaign(ctx, e.payload);
    case 'MissionBegun':
      return beginMission(ctx, e.payload.mission);
    case 'MissionCancelled': {
      const ms = ctx.s.missions[e.payload.mission]!;
      ms.status = ctx.s.activeMissionPrior ?? 'available';
      ctx.s.activeMission = null;
      ctx.s.activeMissionPrior = null;
      return log(ctx, `Mission aborted before play: ${missionName(ctx, e.payload.mission)}.`, { type: 'mission', key: e.payload.mission });
    }
    case 'AarResolved':
      resolveAar(ctx, e.payload.aar);
      return checkStage(ctx);
    case 'StageAdvanced':
      return advanceStage(ctx, e.payload.force);
    case 'CustomMissionAdded': {
      const { stage, mission } = e.payload;
      ctx.s.customMissions[mission.key] = { stage, mission };
      ctx.s.missions[mission.key] = { status: 'available', outcome: null, resolutions: 0, stage, custom: true, notes: null };
      ctx.s.counters.custom++;
      return log(ctx, `Custom mission added: ${mission.name}.`, { type: 'mission', key: mission.key });
    }
    case 'RandomEventRolled':
      rollTable(ctx, emptyScope('table'), e.payload.table);
      return checkStage(ctx);
    case 'ManualAdjustmentApplied': {
      const scope: Scope = { participants: [], subject: e.payload.subject, source: { type: 'manual', key: null } };
      log(ctx, `GM adjustment: ${e.payload.note}`, scope.source);
      applyEffects(ctx, scope, e.payload.effects);
      return checkStage(ctx);
    }
    case 'ChoiceResolved':
      return resolveChoice(ctx, e.payload);
    case 'OperatorUpdated': {
      const { operator, name, callsign, fields } = e.payload;
      const op = ctx.s.operators[operator]!;
      if (name !== undefined) op.name = name;
      if (callsign !== undefined) op.callsign = callsign;
      if (fields) Object.assign(op.fields, fields);
      pushHistory(ctx, op, 'updated', 'Record updated');
      return;
    }
    case 'ContentFilterSet':
      ctx.s.excludedTags = [...e.payload.excludedTags];
      return;
  }
}

function startCampaign(ctx: Ctx, p: EventPayload<'CampaignStarted'>): void {
  const { s, campaign } = ctx;
  Object.assign(s, { status: 'active', campaign: p.campaign, packs: { ...p.packs }, seed: p.seed, excludedTags: [...p.excludedTags] });
  for (const m of campaign.missions) s.missions[m.key] = { status: m.locked ? 'locked' : 'available', outcome: null, resolutions: 0, stage: null, custom: false, notes: null };
  for (const pool of campaign.pools) s.pools[pool.key] = pool.initial;
  for (const t of campaign.tracks) s.tracks[t.key] = { value: t.initial, fired: [] };
  for (const l of campaign.ladders) if (l.scope === 'campaign') s.ladders[l.key] = l.initial;
  for (const pick of p.teams) createTeam(ctx, emptyScope('roster'), campaign.roster.startingTeams.find((t) => t.key === pick.key)!, pick.recruits);
  if (campaign.intro) emitNarrative(ctx, emptyScope('intro'), { title: campaign.name, text: campaign.intro, tags: [] });
  fireTrigger(ctx, 'onCampaignStart', {}, emptyScope('trigger'));
  enterStage(ctx, 0);
  checkStage(ctx);
}

function enterStage(ctx: Ctx, index: number): void {
  const { s } = ctx;
  const stage = ctx.campaign.timeline.stages[index]!;
  s.stageIndex = index;
  s.stage = stage.key;
  s.stageComplete = false;
  log(ctx, `Stage ${index + 1}: ${stage.name}.`, { type: 'stage', key: stage.key });
  showNarrative(ctx, emptyScope('briefing', stage.key), stage.briefing);
  fireTrigger(ctx, 'onStageStart', { stage: stage.key }, emptyScope('trigger'));
}

/** Stage completion is sticky: once endWhen passes or required slots resolve, the player may advance. */
function checkStage(ctx: Ctx): void {
  const { s, campaign } = ctx;
  if (s.status !== 'active' || s.stageComplete || ctx.halted) return;
  const stage = currentStage(campaign, s)!;
  if (slotsComplete(campaign, s) || (stage.endWhen !== undefined && passes(ctx, emptyScope('stage', stage.key), stage.endWhen))) {
    s.stageComplete = true;
    log(ctx, `${stage.name} complete. Advance when ready.`, { type: 'stage', key: stage.key });
  }
}

function advanceStage(ctx: Ctx, force: boolean): void {
  const { s, campaign } = ctx;
  const stage = currentStage(campaign, s)!;
  if (force && !s.stageComplete) log(ctx, `GM override: ${stage.name} ended early.`, { type: 'manual', key: stage.key });
  fireTrigger(ctx, 'onStageEnd', { stage: stage.key }, emptyScope('trigger'));
  if (s.stageIndex + 1 >= campaign.timeline.stages.length) {
    s.status = 'complete';
    s.stageComplete = true;
    log(ctx, `${campaign.name} complete.`, { type: 'stage', key: null });
    return;
  }
  enterStage(ctx, s.stageIndex + 1);
  checkStage(ctx);
}

function beginMission(ctx: Ctx, key: string): void {
  const { s } = ctx;
  const ms = s.missions[key]!;
  s.activeMissionPrior = ms.status;
  ms.status = 'active';
  s.activeMission = key;
  log(ctx, `Mission begun: ${missionName(ctx, key)}.`, { type: 'mission', key });
  const scope: Scope = { participants: [], mission: key, source: { type: 'briefing', key } };
  showNarrative(ctx, scope, missionDef(ctx.campaign, s, key)!.briefing);
  fireTrigger(ctx, 'onMissionStart', { stage: s.stage ?? undefined, mission: key }, { ...scope, source: { type: 'trigger', key: null } });
}

/** Numeric unit count for perUnit effects (booleans count as 0/1). */
const units = (v: Scalar | undefined) => (typeof v === 'number' ? Math.max(0, Math.floor(v)) : v === true ? 1 : 0);

function applyField(ctx: Ctx, scope: Scope, f: AarField, v: Scalar | undefined): void {
  if (v === undefined) return;
  for (const ov of f.onValue) if (ov.value === v) applyEffects(ctx, scope, ov.effects);
  if (f.perUnit.length === 0) return;
  const n = units(v);
  const repeated: Effect[] = [];
  for (let i = 0; i < n && repeated.length < 10_000; i++) repeated.push(...f.perUnit);
  applyEffects(ctx, scope, repeated);
}

function resolveAar(ctx: Ctx, aar: Aar): void {
  const { s, campaign } = ctx;
  const def = missionDef(campaign, s, aar.mission)!;
  const outcome = def.outcomes.find((o) => o.key === aar.outcome)!;
  const ms = s.missions[aar.mission]!;
  Object.assign(ms, { status: 'resolved', outcome: aar.outcome, notes: aar.notes ?? null, resolutions: ms.resolutions + 1 });
  s.activeMission = null;
  s.activeMissionPrior = null;

  const records = Object.entries(aar.operators).filter(([k]) => s.operators[k]?.status === 'active');
  const participants = records.filter(([, r]) => r.participated).map(([k]) => k);
  const source = { type: 'outcome' as const, key: aar.mission };
  log(ctx, `${def.name}: ${outcome.name}.`, source);

  // 1) Engine-recorded stats.
  for (const [k, r] of records) {
    if (!r.participated) continue;
    const op = s.operators[k]!;
    op.stats.missions = (op.stats.missions ?? 0) + 1;
    op.stats.kills = (op.stats.kills ?? 0) + r.kills;
    pushHistory(ctx, op, 'mission', `${def.name}: ${outcome.name}${r.kills ? ` (${r.kills} kills)` : ''}${r.notes ? `. ${r.notes}` : ''}`);
  }

  // 2) Outcome effects, then mission-scope fields, then operator-scope fields per participant.
  const scope: Scope = { participants, mission: aar.mission, source };
  applyEffects(ctx, scope, outcome.effects);
  for (const f of def.aar.fields.filter((x) => x.scope === 'mission')) applyField(ctx, scope, f, aar.fields[f.key] ?? f.default);
  for (const [k, r] of records) {
    if (!r.participated) continue;
    for (const f of def.aar.fields.filter((x) => x.scope === 'operator')) {
      if (s.operators[k]!.status !== 'active') break; // removed mid-resolution (e.g. KIA)
      const engineValue = (ENGINE_AAR_KEYS as readonly string[]).includes(f.key) ? r[f.key as (typeof ENGINE_AAR_KEYS)[number]] : undefined;
      applyField(ctx, { ...scope, subject: k }, f, engineValue ?? r.fields[f.key] ?? f.default);
    }
  }

  // 3) Narrative, then triggers.
  showNarrative(ctx, scope, outcome.narrative);
  showNarrative(ctx, { ...scope, source: { type: 'debrief', key: aar.mission } }, def.debrief);
  fireTrigger(ctx, 'onMissionResolved', { stage: s.stage ?? undefined, mission: aar.mission }, { ...scope, source: { type: 'trigger', key: null } });
}

function resolveChoice(ctx: Ctx, p: EventPayload<'ChoiceResolved'>): void {
  const { s } = ctx;
  const i = s.pending.findIndex((c) => c.key === p.choice);
  const choice = s.pending.splice(i, 1)[0]!;
  if (p.option === 'discard') return log(ctx, `${choice.operator.name ?? 'Recruit'} was not assigned.`, { type: 'roster', key: choice.key });
  createOperator(ctx, emptyScope('roster'), p.option.slice('team:'.length), choice.operator);
}

const missionName = (ctx: Ctx, key: string) => missionDef(ctx.campaign, ctx.s, key)?.name ?? key;
