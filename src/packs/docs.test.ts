import { describe, expect, it } from 'vitest';
import guide from '../../docs/CAMPAIGN_AUTHORING_GUIDE.md?raw';
import format from '../../docs/PACK_FORMAT.md?raw';
import { TEMPLATE_ROOTS } from '$lib/domain/campaign';
import { LOAD_ERROR_CODES, loadPacks } from './loader';
import { valueOf } from './loader/test-helpers';
import * as S from './schema';

// Keeps the authoring docs honest: examples must load, and every schema/DSL name must be documented.
const blocks = (md: string, info: string) => [...md.matchAll(new RegExp('```' + info + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]!);
const mentions = (md: string, name: string) => md.includes('`' + name + '`') || md.includes(`"${name}"`);
const shapeKeys = (s: unknown) => Object.keys((s as { shape: Record<string, unknown> }).shape);

describe('CAMPAIGN_AUTHORING_GUIDE.md', () => {
  it('has at least one complete pack example, and each loads', () => {
    const packs = blocks(guide, 'json pack');
    expect(packs.length).toBeGreaterThan(0);
    for (const src of packs) valueOf(loadPacks([src]));
  });

  it('every json excerpt is valid JSON', () => {
    const excerpts = blocks(guide, 'json');
    expect(excerpts.length).toBeGreaterThan(5);
    for (const src of excerpts) expect(() => JSON.parse(src), src.slice(0, 80)).not.toThrow();
  });

  it('stays within the 6,000-word budget', () => {
    expect(guide.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(6000);
  });

  it('documents every effect, condition, trigger, target keyword, removal reason and template root', () => {
    const names = [...S.EFFECT_OPS, ...S.CONDITION_OPS, ...S.TRIGGER_EVENTS, ...S.TARGET_KEYWORDS, ...S.REMOVE_REASONS, ...TEMPLATE_ROOTS];
    expect(names.filter((n) => !mentions(guide, n) && !guide.includes(`${n}.`))).toEqual([]);
  });
});

describe('PACK_FORMAT.md', () => {
  it('documents every LoadError code, DSL op and trigger', () => {
    const names = [...LOAD_ERROR_CODES, ...S.EFFECT_OPS, ...S.CONDITION_OPS, ...S.TRIGGER_EVENTS];
    expect(names.filter((n) => !mentions(format, n))).toEqual([]);
  });

  it('documents every field of every content kind and campaign primitive', () => {
    const schemas = {
      ...S.CONTENT_KINDS,
      Pack: S.Pack,
      PackContent: S.PackContent,
      Weapon: S.Weapon,
      Ability: S.Ability,
      Specialist: S.Specialist,
      RosterMode: S.RosterMode,
      FieldCheck: S.FieldCheck,
      ScenarioSide: S.ScenarioSide,
      ScoringRule: S.ScoringRule,
      TableEntry: S.TableEntry,
      RosterDef: S.RosterDef,
      TeamDef: S.TeamDef,
      OperatorSeed: S.OperatorSeed,
      Stage: S.Stage,
      MissionSlot: S.MissionSlot,
      Mission: S.Mission,
      AarField: S.AarField,
      Ladder: S.Ladder,
      Pool: S.Pool,
      Track: S.Track,
      Milestone: S.Milestone,
      NarrativeBlock: S.NarrativeBlock,
      Trigger: S.Trigger,
      Persona: S.Persona,
    };
    const missing = Object.entries(schemas).flatMap(([name, s]) => shapeKeys(s).filter((k) => !mentions(format, k)).map((k) => `${name}.${k}`));
    expect(missing).toEqual([]);
  });
});
