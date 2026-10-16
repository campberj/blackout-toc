import { describe, expect, it } from 'vitest';
import { createCampaignEngine, replayCampaign, type AarInput, type CampaignEngine } from '$lib/domain/campaign';
import { loadPacks } from './loader';
import { valueOf } from './loader/test-helpers';

// Every first-party pack in packs/ must load (alone and together); GEMINI must play through Window 1.
const bundled = import.meta.glob<{ default: unknown }>('../../packs/*.json', { eager: true });
const packs = Object.fromEntries(Object.entries(bundled).map(([path, m]) => [path.split('/').pop()!, m.default]));
const gemini = packs['blackfall-gemini.json'];

describe('bundled packs', () => {
  it('finds the reference pack', () => expect(gemini).toBeDefined());

  it('loads every pack together', () => {
    valueOf(loadPacks(Object.values(packs)));
  });

  it.each(Object.keys(packs))('%s loads standalone (no hard dependencies)', (file) => {
    valueOf(loadPacks([packs[file]]));
  });
});

describe('GEMINI / COLD IRON', () => {
  const { registry } = valueOf(loadPacks([gemini]));
  const C = 'blackfall-gemini:cold-iron';
  const TEAMS = [{ key: 'revenants' }, { key: 'pale-horse' }, { key: 'ironclad' }];

  const begin = (seed = 1): CampaignEngine => {
    const e = createCampaignEngine(registry);
    const r = e.start({ campaign: C, seed, packs: { 'blackfall-gemini': '1.0.0' }, excludedTags: [], teams: TEAMS });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    return e;
  };
  const aar = (e: CampaignEngine, a: AarInput) => {
    const r = e.dispatch({ type: 'resolveAar', aar: a });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  };
  const advance = (e: CampaignEngine) => {
    const r = e.dispatch({ type: 'advanceStage' });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  };
  const track = (e: CampaignEngine, k: string) => e.state.tracks[k]!.value;
  const team = (e: CampaignEngine, k: string) => e.state.teams[k]!.ladders['readiness'];
  const op = (e: CampaignEngine, k: string) => e.state.operators[k]!;
  const feedHas = (e: CampaignEngine, title: string) => e.state.feed.some((f) => f.kind === 'narrative' && f.title === title);

  it('starts in Window 1 with the documented tracks and roster', () => {
    const e = begin();
    expect(e.state.stage).toBe('w1');
    expect([track(e, 'stability'), track(e, 'escalation'), track(e, 'intel')]).toEqual([5, 2, 0]);
    expect(e.availableMissions().map((m) => m.key)).toEqual(['first-light', 'tripwire']);
    expect(Object.keys(e.state.operators)).toEqual(['acheron', 'voss', 'skade', 'adeyemi', 'golem-7', 'golem-12']);
    expect(op(e, 'acheron').fields['grade']).toBe('WO2');
    expect(e.state.assets).toEqual({ 'stratcom-sigint': 1, 'authority-qrf': 1, medevac: 1 });
    expect(e.state.feed.some((f) => f.kind === 'warning' || f.kind === 'error')).toBe(false);
  });

  it('scripted Window 1: FIRST LIGHT → TRIPWIRE → PALE SIGNAL → Window 2', () => {
    const e = begin();

    // FIRST LIGHT: Revenants + Ironclad attached.
    aar(e, {
      mission: 'first-light',
      outcome: 'success',
      fields: { vp: 6, 'op-claimed': true, 'recon-reported': true },
      operators: {
        acheron: { kills: 2 },
        voss: { fields: { casualty: 'light' } },
        'golem-7': { kills: 1, fields: { 'golem-damage': 'damaged' } },
        'golem-12': {},
      },
    });
    expect([track(e, 'stability'), track(e, 'escalation')]).toEqual([6, 3]);
    expect([team(e, 'revenants'), team(e, 'ironclad'), team(e, 'pale-horse')]).toEqual(['amber', 'amber', 'green']);
    expect(op(e, 'acheron').stats['xp']).toBe(4); // deployed + success + 2 kills
    expect(op(e, 'voss').stats['xp']).toBe(3); // deployed + success + survived casualty
    expect(op(e, 'voss').ladders['casualty']).toBe('light');
    expect(op(e, 'golem-7').stats['xp']).toBe(0); // Golems earn no XP
    expect(op(e, 'golem-7').ladders['drone-status']).toBe('damaged');
    expect(e.state.flags['golems-committed']).toBe(true);
    expect(e.state.assets['op-deck-58']).toBe(1);
    expect(e.state.missions['pale-signal']!.status).toBe('locked');

    // TRIPWIRE: Pale Horse, cell leader detained.
    aar(e, {
      mission: 'tripwire',
      outcome: 'success',
      fields: { vp: 5, pois: 0, 'cell-leader': 'detained' },
      operators: { skade: { kills: 1 }, adeyemi: { kills: 1, fields: { casualty: 'shaken' } } },
    });
    expect(track(e, 'stability')).toBe(9); // +1 success, +2 detainee
    expect(e.state.tracks['stability']!.fired).toContain('secure');
    expect(e.state.flags['network-map']).toBe(true);
    expect(team(e, 'pale-horse')).toBe('amber');
    expect(op(e, 'adeyemi').ladders['morale']).toBe('shaken');
    expect(op(e, 'golem-7').ladders['drone-status']).toBe('operational'); // priority repair at Stability 8+
    expect(e.state.missions['pale-signal']!.status).toBe('available');
    expect(e.state.stageComplete).toBe(true);
    expect(feedHas(e, 'PALE SIGNAL Authorized')).toBe(true);

    // PALE SIGNAL: Intel 5 fires the classified-briefing milestone.
    expect(feedHas(e, 'Classified Briefing')).toBe(false);
    aar(e, {
      mission: 'pale-signal',
      outcome: 'enhanced',
      fields: { intel: 5, pois: 2, discovery: 'warm-recovered', withdrawal: 'shadows' },
      operators: { acheron: {} },
    });
    expect(track(e, 'intel')).toBe(5);
    expect(e.state.tracks['intel']!.fired).toEqual(['classified-briefing']);
    expect(e.state.flags['intel-briefed']).toBe(true);
    expect(feedHas(e, 'Classified Briefing')).toBe(true);
    expect(track(e, 'stability')).toBe(10);
    expect(e.state.assets['encryption-key']).toBe(1);

    // Window 2: readiness resets, light wound returns, Shaken persists until the next mission.
    advance(e);
    expect(e.state.stage).toBe('w2');
    expect([team(e, 'revenants'), team(e, 'pale-horse'), team(e, 'ironclad')]).toEqual(['green', 'green', 'green']);
    expect(op(e, 'voss').ladders['casualty']).toBe('fit');
    expect(op(e, 'adeyemi').ladders['morale']).toBe('shaken');
    expect(e.state.flags['golems-committed']).toBe(false);
    expect(e.state.missions['tasking']!.status).toBe('available');
    expect(e.availableMissions().map((m) => m.key)).toEqual(['tasking']);
    expect(e.state.pools['reinforcement-clock']).toBe(1);
    expect(e.state.feed.some((f) => f.kind === 'warning' || f.kind === 'error')).toBe(false);
    expect(e.state.feed.some((f) => f.text.includes('[?'))).toBe(false);

    expect(replayCampaign(registry, e.events)).toEqual(e.state);
  });

  it('keeps PALE SIGNAL locked unless both primaries succeed', () => {
    const e = begin();
    aar(e, { mission: 'first-light', outcome: 'partial', operators: { acheron: {} } });
    aar(e, { mission: 'tripwire', outcome: 'enhanced', operators: { skade: {} } });
    expect(e.state.missions['pale-signal']!.status).toBe('locked');
    expect(e.state.stageComplete).toBe(true);
  });

  it('flags a second Golem tasking below Stability 8', () => {
    const e = begin();
    aar(e, { mission: 'first-light', outcome: 'partial', operators: { 'golem-7': {} } });
    aar(e, { mission: 'tripwire', outcome: 'partial', operators: { 'golem-12': {} } });
    expect(feedHas(e, 'Allocation')).toBe(true);
  });

  it('casualties: KIA, critical wounds across an Operation boundary, content filter', () => {
    const e = begin();
    e.dispatch({ type: 'setContentFilter', excludedTags: ['casualty'] });
    aar(e, {
      mission: 'first-light',
      outcome: 'failure',
      operators: { acheron: { fields: { casualty: 'kia' } }, voss: { fields: { casualty: 'critical' } }, 'golem-7': { fields: { 'golem-damage': 'destroyed' } } },
    });
    expect(op(e, 'acheron').removal?.reason).toBe('kia');
    expect(e.state.pools['butchers-bill']).toBe(1);
    expect(e.state.feed.some((f) => f.kind === 'filtered')).toBe(true); // KIA notice withheld
    expect(op(e, 'golem-7').removal?.reason).toBe('retired');
    expect(e.state.pools['butchers-bill']).toBe(1); // Golems are not KIA
    expect(op(e, 'voss').stats['penalties']).toBe(1);
    expect(op(e, 'voss').ladders['critical']).toBe('critical');
    expect(track(e, 'stability')).toBe(4);

    aar(e, { mission: 'tripwire', outcome: 'failure', operators: { skade: {} } });
    for (const w of ['w2', 'w3', 'w4']) {
      advance(e);
      expect(e.state.stage).toBe(w);
      expect(op(e, 'voss').ladders['critical']).toBe('critical');
    }
    advance(e); // Operation II
    expect(e.state.stage).toBe('w5');
    expect(op(e, 'voss').ladders['critical']).toBe('clear');
    expect(e.state.pools['reinforcement-clock']).toBe(0); // reviewed at the end of Window 4
    expect(feedHas(e, 'Personnel Review')).toBe(true);
    expect(feedHas(e, 'Operation II — COUNTERSTRIKE')).toBe(true);
    expect(replayCampaign(registry, e.events)).toEqual(e.state);
  });

  it('runs generic windows to campaign end without warnings', () => {
    const e = begin(42);
    aar(e, { mission: 'first-light', outcome: 'success', operators: { acheron: {} } });
    aar(e, { mission: 'tripwire', outcome: 'success', operators: { skade: {} } });
    for (let w = 2; w <= 12; w++) {
      advance(e);
      aar(e, { mission: 'tasking', outcome: 'success', fields: { 'mission-type': 'counter-network', intel: 1 }, operators: { skade: { kills: 1 } } });
    }
    advance(e);
    expect(e.state.status).toBe('complete');
    expect(track(e, 'intel')).toBe(11);
    expect(e.state.missions['cold-trace']!.status).toBe('available');
    expect(op(e, 'skade').stats['xp']).toBe(35); // 2 (TRIPWIRE) + 11 × (deployed + success + kill)
    expect(op(e, 'skade').rank).toBe('tier-3'); // ≥ 33
    expect(e.state.feed.some((f) => f.kind === 'warning' || f.kind === 'error')).toBe(false);
    expect(e.state.feed.some((f) => f.text.includes('[?'))).toBe(false);
  });
});
