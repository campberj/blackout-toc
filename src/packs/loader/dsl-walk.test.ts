import { describe, expect, it } from 'vitest';
import { Campaign, type Condition, type Effect, Pack } from '../schema';
import { walkCondition, walkDslIn, walkEffects } from './dsl-walk';
import { fixtures } from './test-helpers';

describe('DSL walker', () => {
  const effects: Effect[] = [
    {
      op: 'if',
      cond: { op: 'all', of: [{ op: 'not', cond: { op: 'flag', flag: 'a' } }, { op: 'any', of: [{ op: 'stageIs', stage: 's' }] }] },
      then: [{ op: 'setFlag', flag: 'b', value: true }],
      else: [{ op: 'if', cond: { op: 'roll', sides: 6, gte: 4 }, then: [{ op: 'lockMission', mission: 'm' }] }],
    },
  ];

  it('visits nested effects and conditions with paths', () => {
    const seen: string[] = [];
    walkEffects(effects, {
      effect: (e, p) => void seen.push(`E:${e.op}@${p.join('.')}`),
      condition: (c, p) => void seen.push(`C:${c.op}@${p.join('.')}`),
    });
    expect(seen).toEqual([
      'E:if@0',
      'C:all@0.cond',
      'C:not@0.cond.of.0',
      'C:flag@0.cond.of.0.cond',
      'C:any@0.cond.of.1',
      'C:stageIs@0.cond.of.1.of.0',
      'E:setFlag@0.then.0',
      'E:if@0.else.0',
      'C:roll@0.else.0.cond',
      'E:lockMission@0.else.0.then.0',
    ]);
  });

  it("'skip' prunes children", () => {
    const seen: string[] = [];
    walkEffects(effects, { effect: (e) => (seen.push(e.op), 'skip') });
    expect(seen).toEqual(['if']);
    const cs: string[] = [];
    walkCondition({ op: 'not', cond: { op: 'flag', flag: 'x' } } as Condition, { condition: (c) => (cs.push(c.op), 'skip') });
    expect(cs).toEqual(['not']);
  });

  it('walkDslIn finds every effect/condition root in a campaign via the schema', () => {
    const camp = Pack.parse(fixtures().demo).content.campaigns[0]!;
    const ops = new Set<string>();
    walkDslIn(Campaign, camp, { effect: (e) => void ops.add(e.op), condition: (c) => void ops.add(c.op) });
    for (const op of ['addXp', 'stepLadder', 'removeOperator', 'addOperator', 'grantAsset', 'addTeam', 'lockMission', 'not', 'flag', 'roll', 'trackGte', 'operatorStat'])
      expect(ops, op).toContain(op);
  });
});
