import { describe, expect, it } from 'vitest';
import { aarFieldSets, initAarDraft, initialValue, isCasualtyField, parseNumber, toAarInput, validateAarDraft } from './aar';
import { startGemini } from './__fixtures__/gemini';
import type { AarPrefill } from '$lib/app';

describe('AAR form model (FIRST LIGHT)', () => {
  const setup = () => {
    const ctx = startGemini();
    const def = ctx.campaign.missions.find((m) => m.key === 'first-light')!;
    return { ...ctx, def };
  };

  it('splits mission/operator fields and folds engine keys into the row', () => {
    const { def } = setup();
    const sets = aarFieldSets(def);
    expect(sets.mission.map((f) => f.key)).toEqual(['vp', 'op-claimed', 'recon-reported', 'scouts-escaped']);
    expect(sets.operator.map((f) => f.key)).toEqual(['casualty', 'golem-damage']);
    expect(sets.help.participated).toMatch(/UTG XP/);
    expect(sets.help.kills).toMatch(/per confirmed kill/);
    expect(isCasualtyField(sets.operator[0]!)).toBe(true);
    expect(isCasualtyField(sets.mission[0]!)).toBe(false);
  });

  it('initial draft: briefing selection marks participants, pack defaults fill controls', () => {
    const { campaign, engine } = setup();
    const d = initAarDraft(campaign, engine.state, 'first-light', { selected: ['acheron', 'voss'] })!;
    expect(d.outcome).toBe('');
    expect(Object.keys(d.operators)).toEqual(['acheron', 'voss', 'skade', 'adeyemi', 'golem-7', 'golem-12']);
    expect(d.operators['acheron']).toMatchObject({ participated: true, kills: 0, fields: { casualty: 'none', 'golem-damage': 'none' }, observed: null });
    expect(d.operators['skade']!.participated).toBe(false);
    expect(d.fields).toEqual({ vp: undefined, 'op-claimed': false, 'recon-reported': false, 'scouts-escaped': false });
    expect(initAarDraft(campaign, engine.state, 'nope')).toBeNull();
    expect(initialValue({ kind: 'text', default: undefined })).toBeUndefined();
  });

  it('dashboard pre-fill wins for participants/kills/outcome and records observed status', () => {
    const { campaign, engine } = setup();
    const prefill: AarPrefill = {
      campaignSaveId: 's',
      mission: 'first-light',
      outcome: 'success',
      rounds: 5,
      notes: 'Table notes',
      operators: { skade: { participated: true, kills: 3, status: 'down' }, acheron: { participated: false, kills: 0, status: 'ok' } },
    };
    const d = initAarDraft(campaign, engine.state, 'first-light', { selected: ['acheron'], prefill })!;
    expect(d).toMatchObject({ outcome: 'success', notes: 'Table notes', prefilled: true, rounds: 5 });
    expect(d.operators['skade']).toMatchObject({ participated: true, kills: 3, observed: 'down' });
    expect(d.operators['acheron']!.participated).toBe(false);
    const bad = initAarDraft(campaign, engine.state, 'first-light', { prefill: { ...prefill, outcome: 'bogus' } })!;
    expect(bad.outcome).toBe('');
  });

  it('draft → command: only set values; non-participants carry nothing; engine accepts it', () => {
    const { campaign, engine, def } = setup();
    const d = initAarDraft(campaign, engine.state, 'first-light', { selected: ['acheron'] })!;
    d.outcome = 'success';
    d.fields['vp'] = 6;
    d.operators['acheron']!.kills = 2.7;
    d.operators['acheron']!.notes = '  steady  ';
    d.operators['acheron']!.fields['casualty'] = 'light';
    d.notes = ' ';
    const input = toAarInput(d);
    expect(input.fields).toEqual({ vp: 6, 'op-claimed': false, 'recon-reported': false, 'scouts-escaped': false });
    expect(input.operators!['acheron']).toEqual({ participated: true, kills: 2, fields: { casualty: 'light', 'golem-damage': 'none' }, notes: 'steady' });
    expect(input.operators!['voss']).toEqual({ participated: false, kills: 0, fields: {} });
    expect('notes' in input).toBe(false);
    expect(validateAarDraft(def, d)).toEqual([]);
    expect(engine.dispatch({ type: 'resolveAar', aar: input }).ok).toBe(true);
  });

  it('validation: outcome, someone deployed, number ranges', () => {
    const { campaign, engine, def } = setup();
    const d = initAarDraft(campaign, engine.state, 'first-light')!;
    d.fields['vp'] = 99;
    expect(validateAarDraft(def, d)).toEqual(['Pick an outcome.', 'Mark at least one operator as deployed.', 'Victory points: maximum 12.']);
    d.fields['vp'] = -9;
    expect(validateAarDraft(def, d)).toContain('Victory points: minimum -5.');
  });

  it('parseNumber', () => {
    expect([parseNumber(''), parseNumber(' 3 '), parseNumber('x')]).toEqual([undefined, 3, undefined]);
  });
});
