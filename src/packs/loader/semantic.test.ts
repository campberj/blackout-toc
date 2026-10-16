import { describe, expect, it } from 'vitest';
import { loadPacks } from './load';
import { errorsOf, fixtures, valueOf, type Json } from './test-helpers';

/** Mutate the demo campaign, load demo+other, return [code, path, message] for each error. */
const withCampaign = (mutate: (c: Json, d: Json) => void) => {
  const { demo, other } = fixtures();
  mutate(demo.content.campaigns[0], demo);
  const r = loadPacks([demo, other]);
  return (r.ok ? [] : r.error).map((e) => [e.code, e.path.replace('/content/campaigns/0', ''), e.message] as const);
};
const paths = (mutate: (c: Json, d: Json) => void) => withCampaign(mutate).map(([code, path]) => `${code} ${path}`);

describe('semantic validation: campaign keys', () => {
  it('mission keys in slots, unlockMission, lockMission, trigger filters', () => {
    expect(
      paths((c) => {
        c.timeline.stages[0].slots[0].missions = ['ghost'];
        c.missions[0].outcomes[0].effects[2] = { op: 'unlockMission', mission: 'ghost', stage: 'ghost-stage' };
        c.triggers[2].effects[0].mission = 'ghost';
        c.triggers[2].filter = { stage: 'x', mission: 'y', track: 'z', milestone: 'reinforce' };
      }),
    ).toEqual([
      'unresolved_key /missions/0/outcomes/0/effects/2/mission',
      'unresolved_key /missions/0/outcomes/0/effects/2/stage',
      'unresolved_key /triggers/2/effects/0/mission',
      'unresolved_key /timeline/stages/0/slots/0/missions/0',
      'unresolved_key /triggers/2/filter/stage',
      'unresolved_key /triggers/2/filter/mission',
      'unresolved_key /triggers/2/filter/track',
      'unresolved_key /triggers/2/filter/milestone',
    ]);
  });

  it('trigger milestone filter without track searches every track', () => {
    expect(paths((c) => (c.triggers[2].filter = { milestone: 'reinforce' }))).toEqual([]);
    expect(paths((c) => (c.triggers[2].filter = { milestone: 'nope' }))).toEqual(['unresolved_key /triggers/2/filter/milestone']);
  });

  it('ladder, pool, track, stat, flag-free keys in effects and nested conditions', () => {
    const errs = paths((c) => {
      const out = c.missions[0].outcomes[1].effects;
      out[0] = { op: 'adjustTrack', track: 'ghost', amount: 1 };
      out[1] = { op: 'setLadder', ladder: 'readiness', state: 'ghost' };
      out.push({ op: 'stepLadder', ladder: 'ghost', steps: 1 });
      out.push({ op: 'adjustPool', pool: 'ghost', amount: 1 });
      out.push({ op: 'adjustStat', target: 'subject', stat: 'ghost', amount: 1 });
      out.push({ op: 'adjustStat', target: 'subject', stat: 'kills', amount: 1 }); // built-in
      out.push({ op: 'setFlag', flag: 'anything-goes' }); // flags are free-form
      out.push({
        op: 'if',
        cond: {
          op: 'all',
          of: [
            { op: 'not', cond: { op: 'poolGte', pool: 'ghost', value: 1 } },
            { op: 'any', of: [{ op: 'ladderIs', ladder: 'condition', states: ['ghost'] }, { op: 'stageIs', stage: 'ghost' }] },
            { op: 'operatorStat', target: 'team:ghost', stat: 'resolve', value: 1 },
            { op: 'missionOutcome', mission: 'ghost', outcomes: ['x'] },
            { op: 'missionOutcome', mission: 'recover-lamp', outcomes: ['ghost'] },
            { op: 'missionOutcome', outcomes: ['success', 'ghost'] },
            { op: 'ladderIs', ladder: 'ghost', states: ['x'] },
            { op: 'flag', flag: 'whatever' },
          ],
        },
        then: [{ op: 'addOperator', team: 'ghost', operator: {} }],
        else: [{ op: 'removeOperator', target: 'operator:ghost', reason: 'kia' }],
      });
    });
    const p = '/missions/0/outcomes/1/effects';
    expect(errs).toEqual([
      `unresolved_key ${p}/0/track`,
      `unresolved_key ${p}/1/state`,
      `unresolved_key ${p}/3/ladder`,
      `unresolved_key ${p}/4/pool`,
      `unresolved_key ${p}/5/stat`,
      `unresolved_key ${p}/8/cond/of/0/cond/pool`,
      `unresolved_key ${p}/8/cond/of/1/of/0/states/0`,
      `unresolved_key ${p}/8/cond/of/1/of/1/stage`,
      `unresolved_key ${p}/8/cond/of/2/target`,
      `unresolved_key ${p}/8/cond/of/3/mission`,
      `unresolved_key ${p}/8/cond/of/4/outcomes/0`,
      `unresolved_key ${p}/8/cond/of/5/outcomes/1`,
      `unresolved_key ${p}/8/cond/of/6/ladder`,
      `unresolved_key ${p}/8/then/0/team`,
      `unresolved_key ${p}/8/else/0/target`,
    ]);
  });

  it('persona keys in speakers, narrative keys in refs, rank keys in promote, asset keys', () => {
    expect(
      paths((c) => {
        c.narratives[0].speaker = 'ghost';
        c.missions[0].briefing = 'ghost';
        c.missions[0].outcomes[1].effects[2].narrative.speaker = 'ghost';
        c.missions[1].outcomes[0].effects[0] = { op: 'promote', target: 'team:ember', rank: 'ghost' };
        c.tracks[0].milestones[0].effects[1] = { op: 'grantAsset', asset: 'ghost', team: 'ghost' };
      }),
    ).toEqual([
      'unresolved_key /missions/1/outcomes/0/effects/0/rank',
      'unresolved_key /tracks/0/milestones/0/effects/1/asset',
      'unresolved_key /tracks/0/milestones/0/effects/1/team',
      'unresolved_key /missions/0/briefing',
      'unresolved_key /missions/0/outcomes/1/effects/2/narrative/speaker',
      'unresolved_key /narratives/0/speaker',
    ]);
  });

  it('teams and operators added by effects are resolvable', () => {
    expect(
      paths((c) => {
        c.triggers[0].effects[0].team.operators = [{ key: 'newbie' }];
        c.missions[1].outcomes[0].effects.push({ op: 'addOperator', team: 'spare', operator: { key: 'late' } });
        c.missions[1].outcomes[0].effects.push({ op: 'removeOperator', target: 'operator:newbie', reason: 'retired' });
        c.missions[1].outcomes[0].effects.push({ op: 'removeOperator', target: 'operator:late', reason: 'retired' });
      }),
    ).toEqual([]);
  });

  it('trackGte value outside track range', () => {
    expect(withCampaign((c) => (c.timeline.stages[1].endWhen.value = 99)).map(([code, path]) => `${code} ${path}`)).toEqual([
      'invalid_value /timeline/stages/1/endWhen/value',
    ]);
  });

  it('AAR fields: onValue matches field kind/options, perUnit needs number', () => {
    expect(
      paths((c) => {
        const f = c.missions[0].aar.fields;
        f[1].onValue[0].value = 'ghost';
        f[1].perUnit = [{ op: 'addXp', target: 'subject', amount: 1 }];
        f.push({ key: 'flagged', label: 'Flagged', kind: 'boolean', scope: 'mission', onValue: [{ value: 'yes', effects: [] }, { value: true, effects: [] }] });
        f[0].onValue = [{ value: 'three', effects: [] }, { value: 3, effects: [{ op: 'adjustPool', pool: 'ghost', amount: 1 }] }];
      }),
    ).toEqual([
      'unresolved_key /missions/0/aar/fields/0/onValue/1/effects/0/pool',
      'invalid_value /missions/0/aar/fields/0/onValue/0/value',
      'invalid_value /missions/0/aar/fields/1/perUnit',
      'invalid_value /missions/0/aar/fields/1/onValue/0/value',
      'invalid_value /missions/0/aar/fields/2/onValue/0/value',
    ]);
  });
});

describe('semantic validation: shared tables', () => {
  it("validates a rolled table's keys in the rolling campaign's context, reported against the table's pack", () => {
    const { demo, other, expansion } = fixtures();
    // ember-watch rolls ember-rumors → demo:night-events (adjustPool supply). Remove ember-watch's supply pool.
    expansion.content.campaigns[0].pools = [];
    expansion.content.campaigns[0].missions[0].outcomes[0].effects.pop();
    expansion.content.tables[0].entries[0].narrative.speaker = 'ghost';
    const errs = errorsOf(loadPacks([demo, other, expansion]));
    expect(errs.map((e) => [e.packId, e.code, e.path])).toEqual([
      ['ember-expansion', 'unresolved_key', '/content/tables/0/entries/0/narrative/speaker'],
      ['demo', 'unresolved_key', '/content/tables/0/entries/1/effects/0/pool'],
    ]);
    expect(errs[1]!.message).toContain('rolled by campaign "ember-expansion:ember-watch"');
  });

  it('table cycles and missing tables do not loop or crash', () => {
    const { demo, other, expansion } = fixtures();
    expansion.content.tables[0].entries[1].effects.push({ op: 'rollTable', table: 'ember-rumors' });
    valueOf(loadPacks([demo, other, expansion]));
    expansion.content.tables[0].entries[1].effects.push({ op: 'rollTable', table: 'ghost' });
    expect(errorsOf(loadPacks([demo, other, expansion])).map((e) => e.code)).toEqual(['unresolved_ref']);
  });

  it('unrolled tables are not checked against any campaign', () => {
    const { demo, other } = fixtures();
    demo.content.tables.push({ id: 'loose', name: 'Loose', entries: [{ key: 'x', weight: 1, label: 'X', effects: [{ op: 'adjustPool', pool: 'nowhere', amount: 1 }] }] });
    valueOf(loadPacks([demo, other]));
  });
});
