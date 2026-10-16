import { describe, expect, it } from 'vitest';
import { blankCustomMission, customAarSummary, toCustomMissionCommand, validateCustomMission } from './custom-mission';
import { newRow } from './effects';
import { startGemini } from './__fixtures__/gemini';

describe('custom mission form', () => {
  it('builds an addCustomMission the engine accepts, with template AAR fields', () => {
    const { engine, campaign } = startGemini();
    const d = blankCustomMission(campaign);
    expect(validateCustomMission(d)).toEqual(['Name the mission.']);
    d.name = 'DEEP WATER';
    d.briefing = 'Clear the pump station.';
    d.objectives = [
      { text: 'Hold the pumps', primary: true, points: 3 },
      { text: ' ', primary: false, points: undefined },
    ];
    d.rewards = [{ ...newRow(campaign, engine.state, 'adjustTrack', 'reward'), ref: 'stability' }];
    const cmd = toCustomMissionCommand(d);
    expect(cmd.mission.objectives).toEqual([{ key: 'obj-1', text: 'Hold the pumps', primary: true, points: 3 }]);
    expect(cmd.mission.briefing).toEqual({ text: 'Clear the pump station.', tags: [], speaker: 'monolith' });
    const r = engine.dispatch(cmd);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const added = engine.availableMissions().find((m) => m.custom)!;
    expect(added.name).toBe('DEEP WATER');
    expect(engine.state.customMissions[added.key]!.mission.aar.fields.some((f) => f.key === 'intel')).toBe(true);
    expect(customAarSummary(campaign).fields).toContain('Gemini Mystery Intel recovered');
  });

  it('flags placeholder braces, long names and bad reward rows', () => {
    const { campaign } = startGemini();
    const d = { ...blankCustomMission(campaign), name: 'x'.repeat(81), briefing: '{{x}}', rewards: [{ op: 'addXp' as const, ref: '', target: '', amount: 1, value: '' }] };
    expect(validateCustomMission(d)).toEqual(['Mission name: 80 characters at most.', 'Briefing: remove {{ }} placeholders.', 'Reward: Pick who this applies to.']);
    expect(customAarSummary({ ...campaign, customMission: undefined }).outcomes).toEqual(['Success', 'Failure']);
    expect(toCustomMissionCommand({ ...blankCustomMission(campaign), name: 'A', speaker: '' }, 'w2')).toMatchObject({ stage: 'w2', mission: { name: 'A' } });
  });
});
