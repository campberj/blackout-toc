import { Mission, type Campaign, type Effect, type Id, type MissionOutcome } from '$lib/packs/schema';
import type { ContentLookup } from '../content';
import type { Decision, EventDraft } from '../events';
import { CampaignCommand, formatIssues, type CampaignCommandInput, type CampaignEvent, type CommandOf } from './commands';
import { checkFieldRecord, ENGINE_AAR_KEYS } from './fields';
import { qualify, type CampaignState } from './state';
import { availableMissions } from './timeline';

type Result = Decision<CampaignEvent>;
const reject = (error: string): Result => ({ ok: false, error });
const accept = (...events: EventDraft<CampaignEvent>[]): Result => ({ ok: true, events });
/** Command minus its discriminant = the event payload. Called after narrowing so the type follows. */
function strip<C extends { type: string }>(c: C): Omit<C, 'type'> {
  const out: Record<string, unknown> = { ...c };
  delete out.type;
  return out as Omit<C, 'type'>;
}

/** Validate a command against current state and emit intent events. Never mutates. */
export function createCampaignDecider(content: ContentLookup) {
  return (s: CampaignState, input: CampaignCommandInput): Result => {
    const parsed = CampaignCommand.safeParse(input);
    if (!parsed.success) return reject(`Invalid command: ${formatIssues(parsed.error)}`);
    const c = parsed.data;
    if (c.type === 'startCampaign') return start(content, s, c);
    if (s.status === 'new' || !s.campaign) return reject('Campaign not started');
    const campaign = content.get('campaign', s.campaign);
    if (!campaign) return reject(`Campaign "${s.campaign}" is not loaded`);
    if (s.status === 'complete' && !['applyManualAdjustment', 'updateOperator', 'setContentFilter'].includes(c.type)) return reject('Campaign is complete');
    return decide(content, campaign, s, c);
  };
}

function start(content: ContentLookup, s: CampaignState, c: CommandOf<'startCampaign'>): Result {
  if (s.status !== 'new') return reject('Campaign already started');
  const campaign = content.get('campaign', c.campaign);
  if (!campaign) return reject(`Unknown campaign "${c.campaign}"`);
  const { roster } = campaign;
  const keys = c.teams.map((t) => t.key);
  if (new Set(keys).size !== keys.length) return reject('Duplicate team pick');
  if (roster.pick.min !== undefined && keys.length < roster.pick.min) return reject(`Pick at least ${roster.pick.min} team(s)`);
  if (roster.pick.max !== undefined && keys.length > roster.pick.max) return reject(`Pick at most ${roster.pick.max} team(s)`);
  if (roster.teamsMax !== undefined && keys.length > roster.teamsMax) return reject(`At most ${roster.teamsMax} team(s)`);
  const factions = campaign.factions ?? [];
  if (factions.length && c.faction === undefined) return reject('Pick a faction');
  if (c.faction !== undefined && !factions.some((f) => f.key === c.faction)) return reject(`Unknown faction "${c.faction}"`);
  for (const pick of c.teams) {
    const def = roster.startingTeams.find((t) => t.key === pick.key);
    if (!def) return reject(`Unknown starting team "${pick.key}"`);
    const size = def.operators.length + pick.recruits.length;
    const per = roster.operatorsPerTeam;
    if (per?.max !== undefined && size > per.max) return reject(`${def.name}: at most ${per.max} operators`);
    if (per?.min !== undefined && size < per.min) return reject(`${def.name}: at least ${per.min} operators`);
    for (const r of pick.recruits) {
      const err = checkFieldRecord(roster.operatorFields, r.fields ?? {}, `${def.name} recruit`);
      if (err) return reject(err);
    }
  }
  return accept({ type: 'CampaignStarted', payload: strip(c) });
}

/** Template outcomes (player rewards appended to `success`, else the first), or the v1 success/failure pair. */
function customOutcomes(campaign: Campaign, rewards: Effect[]): MissionOutcome[] {
  const tpl = campaign.customMission?.outcomes;
  if (!tpl) {
    return [
      { key: 'success', name: 'Success', effects: rewards },
      { key: 'failure', name: 'Failure', effects: [] },
    ];
  }
  const target = tpl.find((o) => o.key === 'success') ?? tpl[0]!;
  return tpl.map((o) => (o === target ? { ...o, effects: [...o.effects, ...rewards] } : o));
}

function decide(content: ContentLookup, campaign: Campaign, s: CampaignState, c: Exclude<CampaignCommand, { type: 'startCampaign' }>): Result {
  switch (c.type) {
    case 'beginMission': {
      if (s.activeMission) return reject(`Mission "${s.activeMission}" is already active`);
      if (!availableMissions(campaign, s).some((m) => m.key === c.mission)) return reject(`Mission "${c.mission}" is not available`);
      return accept({ type: 'MissionBegun', payload: { mission: c.mission } });
    }
    case 'cancelMission':
      return s.activeMission ? accept({ type: 'MissionCancelled', payload: { mission: s.activeMission } }) : reject('No active mission');
    case 'resolveAar': {
      const { aar } = c;
      const begin: EventDraft<CampaignEvent>[] = [];
      if (s.activeMission !== aar.mission) {
        if (s.activeMission) return reject(`Mission "${s.activeMission}" is active; resolve or cancel it first`);
        // Convenience: resolving an available mission begins it first (briefing/onMissionStart still run).
        if (!availableMissions(campaign, s).some((m) => m.key === aar.mission)) return reject(`Mission "${aar.mission}" is not available`);
        begin.push({ type: 'MissionBegun', payload: { mission: aar.mission } });
      }
      const def = campaign.missions.find((m) => m.key === aar.mission) ?? s.customMissions[aar.mission]?.mission;
      if (!def) return reject(`Unknown mission "${aar.mission}"`);
      if (!def.outcomes.some((o) => o.key === aar.outcome)) return reject(`Unknown outcome "${aar.outcome}"`);
      const missionFields = def.aar.fields.filter((f) => f.scope === 'mission');
      const operatorFields = def.aar.fields.filter((f) => f.scope === 'operator');
      const err = checkFieldRecord(missionFields, aar.fields, 'AAR');
      if (err) return reject(err);
      for (const [k, r] of Object.entries(aar.operators)) {
        const op = s.operators[k];
        if (!op || op.status !== 'active') return reject(`Operator "${k}" is not on the active roster`);
        const dup = ENGINE_AAR_KEYS.find((x) => x in r.fields);
        if (dup) return reject(`AAR ${op.name}: "${dup}" is engine-recorded; set operators.${k}.${dup} instead`);
        const e = checkFieldRecord(operatorFields, r.fields, `AAR ${op.name}`);
        if (e) return reject(e);
      }
      return accept(...begin, { type: 'AarResolved', payload: strip(c) });
    }
    case 'advanceStage':
      if (s.activeMission) return reject('Resolve or cancel the active mission first');
      if (!s.stageComplete && !c.force) return reject('Stage objectives are not complete');
      return accept({ type: 'StageAdvanced', payload: strip(c) });
    case 'addCustomMission': {
      const stageKey = c.stage ?? s.stage!;
      const idx = campaign.timeline.stages.findIndex((st) => st.key === stageKey);
      if (idx < 0) return reject(`Unknown stage "${stageKey}"`);
      if (idx < s.stageIndex) return reject('Cannot add missions to a past stage');
      if (!campaign.timeline.stages[idx]!.allowCustomMissions) return reject(`Stage "${stageKey}" does not allow custom missions`);
      let n = s.counters.custom + 1;
      while (s.missions[`custom-${n}`]) n++;
      const m = c.mission;
      const mission = Mission.safeParse({
        key: `custom-${n}`,
        name: m.name,
        ...(m.scenario === undefined ? {} : { scenario: m.scenario }),
        ...(m.briefing === undefined ? {} : { briefing: m.briefing }),
        objectives: m.objectives,
        aar: campaign.customMission?.aar ?? { fields: [] },
        outcomes: customOutcomes(campaign, m.rewards),
        tags: m.tags,
      });
      if (!mission.success) return reject(`Invalid custom mission: ${formatIssues(mission.error)}`);
      return accept({ type: 'CustomMissionAdded', payload: { stage: stageKey, mission: mission.data } });
    }
    case 'rollRandomEvent':
      if (!content.get('table', qualify(campaign.id, c.table) as Id)) return reject(`Unknown table "${c.table}"`);
      return accept({ type: 'RandomEventRolled', payload: strip(c) });
    case 'applyManualAdjustment':
      if (c.subject !== undefined && !s.operators[c.subject]) return reject(`Unknown operator "${c.subject}"`);
      return accept({ type: 'ManualAdjustmentApplied', payload: strip(c) });
    case 'resolveChoice': {
      const choice = s.pending.find((p) => p.key === c.choice);
      if (!choice) return reject(`No pending choice "${c.choice}"`);
      if (c.option !== 'discard') {
        const team = c.option.startsWith('team:') ? c.option.slice(5) : '';
        if (!s.teams[team]) return reject(`Option must be "discard" or "team:<key>" of an existing team`);
        const max = campaign.roster.operatorsPerTeam?.max;
        const size = s.teams[team]!.operators.filter((k) => s.operators[k]?.status === 'active').length;
        if (max !== undefined && size >= max) return reject(`${s.teams[team]!.name} is at full strength`);
      }
      return accept({ type: 'ChoiceResolved', payload: strip(c) });
    }
    case 'updateOperator': {
      if (!s.operators[c.operator]) return reject(`Unknown operator "${c.operator}"`);
      const err = checkFieldRecord(campaign.roster.operatorFields, c.fields ?? {}, 'Operator');
      return err ? reject(err) : accept({ type: 'OperatorUpdated', payload: strip(c) });
    }
    case 'setContentFilter':
      return accept({ type: 'ContentFilterSet', payload: strip(c) });
  }
}
