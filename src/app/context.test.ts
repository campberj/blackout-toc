import { describe, expect, it } from 'vitest';
import { bundle, clock, draft, fx, ids, memStorage, rulesPack } from './__fixtures__';
import { createAppContext } from './context';
import { createEmitter } from './emitter';
import { emptyBundle, randomId, randomSeed } from './ports';
import { createStorage } from './storage';
import * as api from '.';

describe('createAppContext', () => {
  it('wires services over one storage + bundled packs', async () => {
    const storage = memStorage();
    const ctx = await createAppContext(storage, bundle(fx().other, fx().demo, rulesPack()), { clock: clock(), newId: ids(), newSeed: () => 3 });
    expect(ctx.isPersistent).toBe(false);
    expect(ctx.snapshot().errors).toEqual([]);
    expect(ctx.activeRulesetId()).toBe('house-rules:supplemental-2026');
    expect(ctx.cardContext()).toEqual({ lookup: ctx.snapshot().registry, rulesetId: 'house-rules:supplemental-2026' });

    await ctx.settings.setExcludedTags(['gore']);
    const camp = await ctx.campaigns.create({ name: 'C', campaign: 'demo:long-night', teams: [{ key: 'ember' }] });
    expect(camp.ok && camp.value.state.excludedTags).toEqual(['gore']);
    expect(camp.ok && camp.value.state.seed).toBe(3);

    const unit = await ctx.customUnits.create(draft({ skill: 9 }));
    expect(unit.ok ? [] : unit.error.map((i) => i.key)).toEqual(['skill']); // supplemental-2026 limit
    await ctx.settings.setActiveRuleset('demo:house');
    expect((await ctx.customUnits.create(draft())).ok).toBe(true);

    const roster = await ctx.rosters.create({ name: 'R', mode: 'matched' });
    expect(roster.ok && roster.value.roster.rulesetId).toBe('demo:house');
  });

  it('works with createStorage(inMemory) and an empty bundle', async () => {
    const app = await createStorage({ inMemory: true });
    const ctx = await createAppContext(app.storage, emptyBundle);
    expect(ctx.activeRulesetId()).toBeUndefined();
    expect(ctx.snapshot().packs).toEqual([]);
    app.close();
  });

  it('default sources and emitter', () => {
    expect(randomId()).toMatch(/^[0-9a-f-]{36}$/);
    const s = randomSeed();
    expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
    const e = createEmitter<number>();
    const got: number[] = [];
    const off = e.subscribe((n) => got.push(n));
    e.emit(1);
    off();
    e.emit(2);
    expect(got).toEqual([1]);
  });

  it('barrel exposes the public API', () => {
    expect(typeof api.createAppContext).toBe('function');
    expect(api.USER_PACK_ID).toBe('user');
    expect(api.formatIssue({ severity: 'error', path: 'skill', code: 'limit', message: 'Too high' })).toBe('skill: Too high');
    expect(api.formatIssue({ severity: 'error', path: '', code: 'x', message: 'Whole' })).toBe('Whole');
    expect(api.humanPath('/a~1b/0/c~0d')).toBe('a/b[0].c~d');
    expect(api.formatLoadErrors([{ code: 'json_syntax', path: '', message: 'Bad' }])).toEqual(['Bad']);
  });
});
