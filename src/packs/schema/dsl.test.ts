import { describe, expect, it } from 'vitest';
import { Condition, CONDITION_OPS, Effect, EFFECT_OPS, Target, TemplateText, templateVars } from './index';

describe('DSL op sets (frozen at G1 — DESIGN §6)', () => {
  it('effects', () => {
    expect(EFFECT_OPS).toEqual([
      'addXp', 'stepLadder', 'setLadder', 'adjustPool', 'adjustTrack', 'setFlag', 'addOperator', 'removeOperator',
      'addTeam', 'unlockMission', 'lockMission', 'rollTable', 'showNarrative', 'grantAsset', 'promote',
      'adjustStat', 'if',
    ]);
  });
  it('conditions', () => {
    expect(CONDITION_OPS).toEqual(['flag', 'trackGte', 'poolGte', 'missionOutcome', 'ladderIs', 'operatorStat', 'stageIs', 'roll', 'all', 'any', 'not']);
  });
});

describe('Target selector', () => {
  it.each(['participants', 'roster', 'subject', 'operator:wren', 'team:ember'])('accepts %j', (t) => expect(Target.safeParse(t).success).toBe(true));
  it.each(['everyone', 'operator:', 'team:Ember', 'squad:a', 'operator:a:b'])('rejects %j', (t) => expect(Target.safeParse(t).success).toBe(false));
});

describe('Effect', () => {
  it('parses with defaults', () => {
    expect(Effect.parse({ op: 'setFlag', flag: 'x' })).toEqual({ op: 'setFlag', flag: 'x', value: true });
    expect(Effect.parse({ op: 'rollTable', table: 't' })).toEqual({ op: 'rollTable', table: 't', times: 1 });
  });
  it('rejects unknown op with a discriminator issue', () => {
    const r = Effect.safeParse({ op: 'runScript', code: 'alert(1)' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(['op']);
  });
  it('rejects unknown fields and bad targets', () => {
    expect(Effect.safeParse({ op: 'addXp', target: 'participants', amount: 1, extra: 1 }).success).toBe(false);
    expect(Effect.safeParse({ op: 'stepLadder', ladder: 'l', target: 'all-of-them', steps: 1 }).success).toBe(false);
    expect(Effect.safeParse({ op: 'removeOperator', target: 'subject', reason: 'vaporized' }).success).toBe(false);
  });
  it('showNarrative accepts key or inline block', () => {
    expect(Effect.safeParse({ op: 'showNarrative', narrative: 'brief' }).success).toBe(true);
    expect(Effect.safeParse({ op: 'showNarrative', narrative: { text: 'Hi {{name}}' } }).success).toBe(true);
    expect(Effect.safeParse({ op: 'showNarrative', narrative: { text: 'Hi {{name' } }).success).toBe(false);
  });
});

describe('Condition', () => {
  it('parses deeply nested all/any/not', () => {
    const c = {
      op: 'all',
      of: [
        { op: 'not', cond: { op: 'any', of: [{ op: 'flag', flag: 'a' }, { op: 'roll', sides: 6, gte: 4 }] } },
        { op: 'ladderIs', ladder: 'l', states: ['x'] },
      ],
    };
    const parsed = Condition.parse(c);
    expect(parsed).toMatchObject(c);
    // default applied inside recursion
    expect(parsed.op === 'all' && parsed.of[1]).toMatchObject({ match: 'any' });
  });
  it('reports nested path for bad inner op', () => {
    const r = Condition.safeParse({ op: 'all', of: [{ op: 'not', cond: { op: 'eval' } }] });
    expect(r.error!.issues[0]!.path).toEqual(['of', 0, 'cond', 'op']);
  });
  it('rejects empty all/any', () => {
    expect(Condition.safeParse({ op: 'any', of: [] }).success).toBe(false);
  });
});

describe('templates', () => {
  it('extracts vars and flags malformed braces', () => {
    expect(templateVars('{{a}} and {{ b.c }}')).toEqual(['a', 'b.c']);
    expect(TemplateText.safeParse('ok {{x}}').success).toBe(true);
    expect(TemplateText.safeParse('bad }} text').success).toBe(false);
    expect(TemplateText.safeParse('bad {{1x}}').success).toBe(false);
  });
});

describe('G1 additions', () => {
  it('parses nested if/else', () => {
    const r = Effect.safeParse({
      op: 'if', cond: { op: 'trackGte', track: 'intel', value: 5 },
      then: [{ op: 'adjustStat', target: 'participants', stat: 'stress', amount: 1 }],
      else: [{ op: 'if', cond: { op: 'roll', sides: 10, gte: 6 }, then: [{ op: 'setFlag', flag: 'lucky' }] }],
    });
    expect(r.success).toBe(true);
  });
  it('rejects if without cond', () => expect(Effect.safeParse({ op: 'if', then: [] }).success).toBe(false));
});

describe('review fixes', () => {
  it('template vars accept slug keys with dashes', () => {
    expect(TemplateText.safeParse('Intel at {{track.gemini-intel}}').success).toBe(true);
    expect(templateVars('{{ pool.sector-stability.name }}')).toEqual(['pool.sector-stability.name']);
  });
});
