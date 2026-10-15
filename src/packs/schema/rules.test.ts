import { describe, expect, it } from 'vitest';
import { CalibrationProfile, FieldCheck, InlineScenario, RulesetProfile, Scenario } from './index';

const ruleset = { id: 'r', name: 'R', startingCp: 3, roundLimit: 5, dusterRules: 'core', coverModel: 'binary' };

describe('RulesetProfile', () => {
  it('defaults and enums', () => {
    expect(RulesetProfile.parse(ruleset)).toMatchObject({ cpCaps: {}, unitLimits: [], rosterModes: [] });
    expect(RulesetProfile.safeParse({ ...ruleset, coverModel: 'none' }).success).toBe(false);
    expect(RulesetProfile.safeParse({ ...ruleset, dusterRules: 'impact-chart' }).success).toBe(true);
  });
  it('rejects duplicate roster modes', () => {
    const m = { mode: 'skirmish', name: 'S', groups: {}, forceCardsPerGroup: {}, unitsPerGroup: { max: 1 }, handlersPerGroup: { max: 0 } };
    expect(RulesetProfile.safeParse({ ...ruleset, rosterModes: [m] }).success).toBe(true);
    expect(RulesetProfile.safeParse({ ...ruleset, rosterModes: [m, m] }).success).toBe(false);
  });
});

describe('FieldCheck / calibration', () => {
  it('needs at least one bound', () => {
    expect(FieldCheck.safeParse({ key: 'k', field: 'skill', message: 'm' }).success).toBe(false);
    expect(FieldCheck.safeParse({ key: 'k', field: 'nonsense', min: 1, message: 'm' }).success).toBe(false);
  });
  it('per-type rule: 2 armor dice only for handlers', () => {
    const c = CalibrationProfile.parse({
      id: 'c',
      name: 'C',
      checks: [{ key: 'k', field: 'armor.dice', when: { exceptTypes: ['handler'] }, notIn: [2], message: 'm' }],
    });
    expect(c.checks[0]!.when).toEqual({ exceptTypes: ['handler'] });
    expect(c.rulesets).toEqual([]);
  });
});

describe('Scenario', () => {
  const s = {
    name: 'S',
    tableSize: { width: 36, depth: 36 },
    roundLimit: 5,
    forces: { sides: [{ key: 'a', name: 'A' }] },
    deployment: { text: 'd' },
    scoring: [{ key: 'kill', event: 'kill', label: 'Kill', points: 1 }],
  };
  it('inline scenario defaults', () => {
    const p = InlineScenario.parse(s);
    expect(p.scoreLabel).toBe('VP');
    expect(p.tableSize.unit).toBe('in');
    expect(p.scoring[0]!.timing).toEqual({ when: 'immediate' });
    expect(p.forces.symmetric).toBe(true);
  });
  it('standalone scenario requires id; inline forbids it', () => {
    expect(Scenario.safeParse(s).success).toBe(false);
    expect(Scenario.safeParse({ ...s, id: 'x' }).success).toBe(true);
    expect(InlineScenario.safeParse({ ...s, id: 'x' }).success).toBe(false);
  });
  it('rejects bad timing', () => {
    expect(InlineScenario.safeParse({ ...s, scoring: [{ ...s.scoring[0], timing: { when: 'whenever' } }] }).success).toBe(false);
  });
});
