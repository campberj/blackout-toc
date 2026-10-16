import { describe, expect, it } from 'vitest';
import { loadPacks } from '$lib/packs/loader';
import { COLLECTIONS } from '$lib/ports';
import { fx, memStorage, rulesPack } from './__fixtures__';
import { createSettingsService, SETTINGS_ID } from './settings-service';

const registry = (...packs: object[]) => {
  const r = loadPacks(packs);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value.registry;
};

describe('SettingsService', () => {
  it('defaults, persists and reloads', async () => {
    const storage = memStorage();
    const s = createSettingsService(storage);
    expect(await s.load()).toEqual({ activeRulesetId: null, excludedTags: [] });
    const seen: unknown[] = [];
    s.subscribe((v) => seen.push(v));
    await s.setActiveRuleset('demo:house');
    await s.setExcludedTags(['gore', 'Bad Tag', 'gore', 'body-horror']);
    expect(s.current).toEqual({ activeRulesetId: 'demo:house', excludedTags: ['body-horror', 'gore'] });
    expect(seen).toHaveLength(2);
    const again = createSettingsService(storage);
    expect(await again.load()).toEqual(s.current);
  });

  it('corrupt record falls back field by field', async () => {
    const storage = memStorage();
    await storage.collection(COLLECTIONS.settings).put({ id: SETTINGS_ID, activeRulesetId: 42, excludedTags: 'x' });
    expect(await createSettingsService(storage).load()).toEqual({ activeRulesetId: null, excludedTags: [] });
  });

  it('resolves the active ruleset: stored → *:supplemental-2026 → first → none', async () => {
    const s = createSettingsService(memStorage());
    await s.load();
    const { demo, other } = fx();
    expect(s.resolveRuleset(registry())).toBeUndefined();
    expect(s.resolveRuleset(registry(demo, other))).toBe('other-demo:alt'); // first in load order
    const withRules = registry(demo, other, rulesPack());
    expect(s.resolveRuleset(withRules)).toBe('house-rules:supplemental-2026');
    await s.setActiveRuleset('demo:house');
    expect(s.resolveRuleset(withRules)).toBe('demo:house');
    await s.setActiveRuleset('gone:ruleset');
    expect(s.resolveRuleset(withRules)).toBe('house-rules:supplemental-2026');
  });

  it('theme passes through to the injected port', () => {
    let t: 'dark' | 'light' | 'system' = 'system';
    const s = createSettingsService(memStorage(), { get: () => t, set: (c) => (t = c) });
    s.theme.set('light');
    expect(t).toBe('light');
    const d = createSettingsService(memStorage());
    expect(d.theme.get()).toBe('dark');
    d.theme.set('light');
    expect(d.theme.get()).toBe('light');
  });
});
