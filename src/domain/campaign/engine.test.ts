import { describe, expect, it } from 'vitest';
import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import { Effect } from '$lib/packs/schema';
import { createCampaignEngine, replayCampaign, validateEvent, MAX_DEPTH, MAX_STEPS, type CampaignEngine, type CampaignEvent } from './index';
import { applyEffects } from './effects';
import { content, ctxFor, feedText, IRON, ironEngine, must, scope } from './__fixtures__/harness';
import { lookupFromPacks } from './__fixtures__/lookup';
import { createCampaignReducer } from './reducer';
import { createCampaignDecider } from './decider';
import { initialCampaignState } from './state';

const op2 = (e: CampaignEngine) => e.state.teams.alpha!.operators[1]!;

/** Full scripted Iron Test run: every command type, every trigger type. */
function ironScript(e: CampaignEngine) {
  must(e, { type: 'beginMission', mission: 'recon' });
  must(e, {
    type: 'resolveAar',
    aar: {
      mission: 'recon',
      outcome: 'success',
      fields: { 'intel-found': true, civilians: 1 },
      operators: { vale: { kills: 2, fields: { wound: 'light' }, notes: 'Point man' }, [op2(e)]: {}, juno: { participated: false }, brook: { kills: 1, fields: { wound: 'grave' } } },
      notes: 'Clean exfil',
    },
  });
  must(e, { type: 'resolveAar', aar: { mission: 'raid-a', outcome: 'success' } }); // auto-begins
  must(e, { type: 'resolveAar', aar: { mission: 'patrol', outcome: 'success' } });
  must(e, { type: 'resolveAar', aar: { mission: 'patrol', outcome: 'success' } }); // repeatable
  must(e, { type: 'rollRandomEvent', table: 'rumors' });
  must(e, { type: 'addCustomMission', mission: { name: 'Side job', rewards: [{ op: 'adjustTrack', track: 'intel', amount: 3 }] } });
  must(e, { type: 'resolveAar', aar: { mission: 'custom-1', outcome: 'success' } });
  must(e, { type: 'updateOperator', operator: 'juno', callsign: 'SPLINT', fields: { kit: 'medkit' } });
  must(e, { type: 'advanceStage' });
  must(e, { type: 'resolveChoice', choice: 'choice-1', option: 'team:bravo' });
  must(e, { type: 'beginMission', mission: 'hunt' });
  must(e, { type: 'resolveAar', aar: { mission: 'hunt', outcome: 'failure', operators: { vale: {} } } });
  must(e, { type: 'applyManualAdjustment', effects: [{ op: 'adjustTrack', track: 'intel', amount: 10 }], note: 'GM fix' });
  must(e, { type: 'advanceStage' });
  must(e, { type: 'resolveAar', aar: { mission: 'finale', outcome: 'success' } });
  must(e, { type: 'advanceStage' });
}

describe('golden: Iron Test', () => {
  it('seed + scripted commands → expected state', () => {
    const e = ironEngine();
    ironScript(e);
    const s = e.state;
    expect(s.status).toBe('complete');
    expect(s.missions.recon).toMatchObject({ status: 'resolved', outcome: 'success', notes: 'Clean exfil', resolutions: 1 });
    expect(s.missions.patrol!.resolutions).toBe(2);
    expect(s.missions['raid-b']!.status).toBe('available'); // slot closed by raid-a, never played
    expect(s.operators.vale).toMatchObject({ stats: { xp: 5, kills: 2, missions: 2, grit: 2 }, rank: 'sgt', ladders: { wounds: 'light' } });
    expect(s.operators.brook).toMatchObject({ status: 'removed', removal: { reason: 'kia', seq: 3 } });
    expect(s.operators.juno).toMatchObject({ callsign: 'SPLINT', fields: { kit: 'medkit', role: 'medic' }, stats: { missions: 0 } });
    expect(s.teams.bravo!.operators).toHaveLength(2);
    expect(s.tracks.intel).toEqual({ value: 12, fired: ['m3', 'm6', 'm10'] });
    expect(s.flags).toMatchObject({ 'intel-3': true, breakthrough: true, 'cp-cut': false });
    expect(s.ladders.alert).toBe('alert');
    expect(s.firedTriggers).toEqual(['m3-flag']);
    expect(s.pending).toEqual([]);
    expect(e.events.map((x) => x.type)).toMatchSnapshot('event types');
    expect(feedText(s)).toMatchSnapshot('feed');
    expect({ ...s, feed: s.feed.length }).toMatchSnapshot('state');
  });

  it('is deterministic per seed and differs across seeds', () => {
    const a = ironEngine(7), b = ironEngine(7), c = ironEngine(8);
    [a, b, c].forEach(ironScript);
    expect(a.state).toEqual(b.state);
    expect(c.state.rngState).not.toBe(a.state.rngState);
  });

  it('replay equality: dispatched state === replayed log, incl. through JSON persistence', () => {
    const e = ironEngine();
    ironScript(e);
    const persisted = JSON.parse(JSON.stringify(e.events)) as CampaignEvent[];
    expect(replayCampaign(content(), persisted)).toEqual(e.state);
    const f = createCampaignEngine(content());
    expect(f.load(persisted)).toEqual({ ok: true, state: e.state });
    expect(persisted.every((x) => validateEvent(x) === undefined)).toBe(true);
  });

  it('undo removes the last command, truncate keeps seq <= n; preview does not commit', () => {
    const e = ironEngine();
    must(e, { type: 'beginMission', mission: 'recon' });
    const before = structuredClone(e.state);
    const p = e.preview({ type: 'resolveAar', aar: { mission: 'recon', outcome: 'failure' } });
    expect(p.ok && p.state.missions.recon!.outcome).toBe('failure');
    expect(e.state).toEqual(before);
    must(e, { type: 'resolveAar', aar: { mission: 'recon', outcome: 'success' } });
    expect(e.undo()).toEqual(before);
    expect(e.events).toHaveLength(2);
    must(e, { type: 'cancelMission' });
    const cancelled = structuredClone(e.state);
    must(e, { type: 'resolveAar', aar: { mission: 'raid-a', outcome: 'success' } }); // auto-begin: 2 events, 1 command
    expect(e.events.slice(-2).map((x) => [x.type, x.cmd])).toEqual([['MissionBegun', 4], ['AarResolved', 4]]);
    expect(e.undo()).toEqual(cancelled);
    expect(e.undo()).toEqual(before);
    expect(e.truncate(1).activeMission).toBeNull();
    expect(e.events).toHaveLength(1);
  });
});

describe('golden: demo pack', () => {
  it('runs The Long Night end to end', () => {
    const e = createCampaignEngine(lookupFromPacks(demo));
    expect(e.start({ campaign: 'demo:long-night', seed: 42, teams: [{ key: 'ember' }], excludedTags: ['mature-themes'] }).ok).toBe(true);
    const moss = e.state.teams.ember!.operators[1]!;
    must(e, { type: 'resolveAar', aar: { mission: 'recover-lamp', outcome: 'failure', operators: { wren: { kills: 3, fields: { injury: 'hurt' } }, [moss]: { fields: { injury: 'hurt' } } } } });
    expect(e.state.teams.ember!.ladders.readiness).toBe('strained');
    expect(e.state.operators.wren).toMatchObject({ stats: { kills: 3, xp: 3 }, ladders: { condition: 'hurt' } });
    must(e, { type: 'applyManualAdjustment', effects: [{ op: 'stepLadder', ladder: 'condition', steps: 1 }], subject: 'wren', note: 'Bled out' });
    expect(e.state.operators.wren!.status).toBe('removed');
    expect(e.state.tracks.dread).toEqual({ value: 4, fired: [] }); // failure +3, '*'→down transition +1
    expect(e.state.pools.supply).toBe(4); // 3 + 2 (stage refresh) − 1 (onOperatorKia)
    must(e, { type: 'applyManualAdjustment', effects: [{ op: 'adjustTrack', track: 'dread', amount: 6 }], note: 'Night deepens' });
    expect(e.state.tracks.dread!.fired).toEqual(['unease', 'reinforce']);
    expect(e.state.teams.ember!.assets['flare-cache']).toBe(1);
    expect(e.state.missions['recover-lamp']!.status).toBe('resolved'); // dread-peak lockMission only locks available
    expect(e.state.stageComplete).toBe(true);
    must(e, { type: 'advanceStage' });
    expect(e.dispatch({ type: 'beginMission', mission: 'hold-line' }).ok).toBe(false); // failure never unlocked it
    must(e, { type: 'applyManualAdjustment', effects: [{ op: 'unlockMission', mission: 'hold-line' }], note: 'Second chance' });
    must(e, { type: 'resolveAar', aar: { mission: 'hold-line', outcome: 'success' } });
    expect(e.state.flags.dawn).toBe(true);
    expect(e.state.operators[moss]!.rank).toBe('veteran');
    expect({ ...e.state, feed: feedText(e.state) }).toMatchSnapshot();
    expect(replayCampaign(lookupFromPacks(demo), e.events)).toEqual(e.state);
  });
});

describe('trigger-loop cap', () => {
  it('a self-retriggering ladder halts with an error entry, state stays replayable', () => {
    const c = content();
    const e = createCampaignEngine(c);
    must(e, { type: 'startCampaign', campaign: 'ops:loop', seed: 1, teams: [{ key: 'solo' }] });
    must(e, { type: 'resolveAar', aar: { mission: 'm', outcome: 'deep' } });
    const errors = e.state.feed.filter((f) => f.kind === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.text).toMatch(new RegExp(`nesting exceeded ${MAX_DEPTH}`));
    expect(e.state.missions.m!.status).toBe('resolved');
    expect(replayCampaign(c, e.events)).toEqual(e.state);
  });

  it('a too-wide effect list halts at MAX_STEPS', () => {
    const ctx = ctxFor(ironEngine());
    applyEffects(ctx, scope(), Array.from({ length: MAX_STEPS + 5 }, () => Effect.parse({ op: 'setFlag', flag: 'x' })));
    expect(ctx.halted).toBe(true);
    expect(ctx.s.feed.at(-1)!.text).toMatch(/more than 5000 effects/);
    applyEffects(ctx, scope(), [Effect.parse({ op: 'setFlag', flag: 'after' })]);
    expect(ctx.s.flags).not.toHaveProperty('after');
  });
});

describe('commands', () => {
  it('startCampaign validation', () => {
    const e = createCampaignEngine(content());
    const start = (over: object) => e.start({ campaign: IRON, seed: 1, teams: [{ key: 'alpha' }], ...over } as never);
    expect(start({ campaign: 'ops:ghost' })).toMatchObject({ ok: false, error: 'Unknown campaign "ops:ghost"' });
    expect(start({ teams: [{ key: 'alpha' }, { key: 'alpha' }] })).toMatchObject({ error: 'Duplicate team pick' });
    expect(start({ teams: [{ key: 'alpha' }, { key: 'bravo' }, { key: 'charlie' }] })).toMatchObject({ error: 'Pick at most 2 team(s)' });
    expect(start({ teams: [{ key: 'zulu' }] })).toMatchObject({ error: 'Unknown starting team "zulu"' });
    expect(start({ teams: [{ key: 'alpha', recruits: [{}, {}] }] })).toMatchObject({ error: 'Team Alpha: at most 3 operators' });
    expect(start({ teams: [{ key: 'alpha', recruits: [{ fields: { role: 'pilot' } }] }] }).ok).toBe(false);
    expect(start({ seed: -1 })).toMatchObject({ ok: false, error: expect.stringMatching(/^Invalid command: seed/) });
    expect(e.dispatch({ type: 'beginMission', mission: 'recon' })).toMatchObject({ error: 'Campaign not started' });
    expect(start({}).ok).toBe(true);
    expect(start({})).toMatchObject({ error: 'Campaign already started' });
  });

  it('pick.min and operatorsPerTeam.min / teamsMax', () => {
    const pack = (patch: (c: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const d = structuredClone(demo) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      patch(d.content.campaigns[0]);
      return createCampaignEngine(lookupFromPacks(d));
    };
    const r1 = pack((c) => (c.roster.pick = { min: 2, max: 2 })).start({ campaign: 'demo:long-night', seed: 1, teams: [{ key: 'ember' }] });
    expect(r1).toMatchObject({ error: 'Pick at least 2 team(s)' });
    const r2 = pack((c) => (c.roster.operatorsPerTeam = { min: 3 })).start({ campaign: 'demo:long-night', seed: 1, teams: [{ key: 'ember' }] });
    expect(r2).toMatchObject({ error: 'Team Ember: at least 3 operators' });
    const r3 = pack((c) => Object.assign(c.roster, { teamsMax: 1, pick: { max: 2 } })).start({ campaign: 'demo:long-night', seed: 1, teams: [{ key: 'ember' }, { key: 'cinder' }] });
    expect(r3).toMatchObject({ error: 'At most 1 team(s)' });
  });

  it('mission flow rejections, cancel, slot closure, stage gating', () => {
    const e = ironEngine();
    expect(e.availableMissions().map((m) => m.key)).toEqual(['recon', 'raid-a', 'raid-b', 'patrol']);
    expect(e.dispatch({ type: 'beginMission', mission: 'hunt' })).toMatchObject({ error: 'Mission "hunt" is not available' });
    expect(e.dispatch({ type: 'cancelMission' })).toMatchObject({ error: 'No active mission' });
    expect(e.dispatch({ type: 'advanceStage' })).toMatchObject({ error: 'Stage objectives are not complete' });
    must(e, { type: 'beginMission', mission: 'recon' });
    expect(e.state.pools.cp).toBe(2); // refresh mode=set on onMissionStart
    expect(e.availableMissions()).toEqual([]);
    expect(e.dispatch({ type: 'beginMission', mission: 'raid-a' })).toMatchObject({ error: 'Mission "recon" is already active' });
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'raid-a', outcome: 'success' } }).ok).toBe(false);
    expect(e.dispatch({ type: 'advanceStage', force: true })).toMatchObject({ error: 'Resolve or cancel the active mission first' });
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'recon', outcome: 'meh' } })).toMatchObject({ error: 'Unknown outcome "meh"' });
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'recon', outcome: 'success', fields: { civilians: 9 } } }).ok).toBe(false);
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'recon', outcome: 'success', operators: { ghost: {} } } })).toMatchObject({ error: 'Operator "ghost" is not on the active roster' });
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'recon', outcome: 'success', operators: { vale: { fields: { wound: 'x' } } } } }).ok).toBe(false);
    expect(e.dispatch({ type: 'resolveAar', aar: { mission: 'recon', outcome: 'success', operators: { vale: { fields: { kills: 2 } } } } })).toMatchObject({
      error: expect.stringMatching(/engine-recorded/),
    });
    must(e, { type: 'cancelMission' });
    expect(e.state.missions.recon!.status).toBe('available');
    must(e, { type: 'resolveAar', aar: { mission: 'raid-b', outcome: 'success' } });
    expect(e.availableMissions().map((m) => m.key)).toEqual(['recon', 'patrol']);
    expect(e.dispatch({ type: 'beginMission', mission: 'raid-b' }).ok).toBe(false); // non-repeatable
  });

  it('failure path: trigger `when` on missionOutcome, team ladder via implicit target', () => {
    const e = ironEngine();
    const supply = e.state.pools.supply!;
    must(e, { type: 'resolveAar', aar: { mission: 'recon', outcome: 'failure' } });
    expect(e.state.teams.alpha!.ladders.readiness).toBe('amber'); // no participants → all teams
    expect(e.state.ladders.alert).toBe('alert');
    expect(e.state.pools.supply).toBe(supply - 1);
  });

  it('endWhen completes a stage early; force-advance; campaign completes and locks commands', () => {
    const e = ironEngine();
    must(e, { type: 'advanceStage', force: true });
    expect(feedText(e.state)).toContain('GM override: Window One ended early.');
    expect(e.state.pending).toHaveLength(1); // alpha full → choice
    must(e, { type: 'applyManualAdjustment', effects: [{ op: 'adjustTrack', track: 'intel', amount: 10 }], note: 'x' });
    expect(e.state.stageComplete).toBe(true);
    must(e, { type: 'advanceStage' });
    expect(e.dispatch({ type: 'addCustomMission', mission: { name: 'x' } })).toMatchObject({ error: 'Stage "three" does not allow custom missions' });
    expect(e.dispatch({ type: 'addCustomMission', stage: 'one', mission: { name: 'x' } })).toMatchObject({ error: 'Cannot add missions to a past stage' });
    expect(e.dispatch({ type: 'addCustomMission', stage: 'nine', mission: { name: 'x' } })).toMatchObject({ error: 'Unknown stage "nine"' });
    must(e, { type: 'advanceStage', force: true });
    expect(e.state.status).toBe('complete');
    expect(e.availableMissions()).toEqual([]);
    expect(e.dispatch({ type: 'advanceStage' })).toMatchObject({ error: 'Campaign is complete' });
    must(e, { type: 'setContentFilter', excludedTags: [] });
    expect(e.state.excludedTags).toEqual([]);
  });

  it('choices, manual adjustment, operator updates, random events', () => {
    const e = ironEngine();
    must(e, { type: 'applyManualAdjustment', effects: [{ op: 'addOperator', team: 'alpha', operator: { name: 'Spare' } }], note: 'reinforce' });
    expect(e.dispatch({ type: 'resolveChoice', choice: 'nope', option: 'discard' })).toMatchObject({ error: 'No pending choice "nope"' });
    expect(e.dispatch({ type: 'resolveChoice', choice: 'choice-1', option: 'team:alpha' })).toMatchObject({ error: 'Team Alpha is at full strength' });
    expect(e.dispatch({ type: 'resolveChoice', choice: 'choice-1', option: 'team:zulu' }).ok).toBe(false);
    must(e, { type: 'resolveChoice', choice: 'choice-1', option: 'discard' });
    expect(e.state.pending).toEqual([]);
    expect(feedText(e.state).at(-1)).toBe('Spare was not assigned.');
    expect(e.dispatch({ type: 'applyManualAdjustment', effects: [{ op: 'setFlag', flag: 'x' }], note: 'n', subject: 'ghost' }).ok).toBe(false);
    expect(e.dispatch({ type: 'applyManualAdjustment', effects: [], note: 'n' }).ok).toBe(false);
    expect(e.dispatch({ type: 'updateOperator', operator: 'ghost' }).ok).toBe(false);
    expect(e.dispatch({ type: 'updateOperator', operator: 'vale', fields: { role: 'pilot' } }).ok).toBe(false);
    must(e, { type: 'updateOperator', operator: 'vale', name: 'Vale Sr.', callsign: null });
    expect(e.state.operators.vale).toMatchObject({ name: 'Vale Sr.', callsign: null });
    expect(e.dispatch({ type: 'rollRandomEvent', table: 'ghost' })).toMatchObject({ error: 'Unknown table "ghost"' });
    must(e, { type: 'rollRandomEvent', table: 'demo:night-events' });
    expect(e.dispatch({ type: 'bogus' } as never).ok).toBe(false);
  });

  it('table `when` sees current stage; custom mission without rewards', () => {
    const e = ironEngine();
    must(e, { type: 'advanceStage', force: true });
    must(e, { type: 'advanceStage', force: true });
    must(e, { type: 'rollRandomEvent', table: 'rumors' }); // late (w50) now eligible
    expect(e.state.tracks.intel!.value).toBeGreaterThanOrEqual(0);
    const f = ironEngine();
    must(f, { type: 'addCustomMission', stage: 'two', mission: { name: 'Later', briefing: { text: '{{mission.name}} go' } } });
    expect(f.availableMissions().map((m) => m.key)).not.toContain('custom-1'); // placed in stage two
    expect(f.state.customMissions['custom-1']!.mission.outcomes.map((o) => o.key)).toEqual(['success', 'failure']);
  });
});

describe('persistence robustness', () => {
  it('load rejects unknown event types and bad payloads', () => {
    const e = createCampaignEngine(content());
    expect(e.load([{ seq: 1, type: 'Nope', payload: {} } as never])).toMatchObject({ ok: false, error: 'Unknown event type "Nope"' });
    expect(e.load([{ seq: 1, type: 'MissionBegun', payload: { mission: 'Bad Key' } } as never]).ok).toBe(false);
  });

  it('reducer never throws when campaign content is missing', () => {
    const reduce = createCampaignReducer(lookupFromPacks(demo));
    const s = reduce(initialCampaignState(), { seq: 1, cmd: 1, type: 'CampaignStarted', payload: { campaign: IRON, seed: 1, teams: [{ key: 'alpha', recruits: [] }], packs: {}, excludedTags: [] } });
    expect(s.feed[0]).toMatchObject({ kind: 'error', text: expect.stringMatching(/not loaded/) });
    const t = reduce(initialCampaignState(), { seq: 1, cmd: 1, type: 'ContentFilterSet', payload: { excludedTags: [] } });
    expect(t.feed[0]!.text).toMatch(/Campaign "\?" is not loaded/);
  });

  it('dispatch rejects when campaign content disappears', () => {
    const e = ironEngine();
    const decide = createCampaignDecider(lookupFromPacks(demo));
    expect(decide(e.state, { type: 'cancelMission' })).toMatchObject({ error: `Campaign "${IRON}" is not loaded` });
    const f = createCampaignEngine(lookupFromPacks(demo));
    f.load(e.events);
    expect(f.dispatch({ type: 'cancelMission' })).toMatchObject({ error: 'Campaign not started' });
    expect(f.state.feed[0]!.kind).toBe('error');
    expect(f.availableMissions()).toEqual([]);
  });
});
