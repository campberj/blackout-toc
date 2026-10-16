// Test-only: the real GEMINI reference pack (original fan content shipped in packs/) driving model tests.
import gemini from '../../../../../../packs/blackfall-gemini.json';
import { createCampaignEngine, type CampaignEngine } from '$lib/domain/campaign';
import { loadPacks } from '$lib/packs/loader';
import type { Campaign, Id } from '$lib/packs/schema';

export const GEMINI_ID = 'blackfall-gemini:cold-iron' as Id;
export const geminiRaw = (): unknown => structuredClone(gemini);

export function geminiContent() {
  const r = loadPacks([gemini]);
  if (!r.ok) throw new Error(`GEMINI failed to load: ${JSON.stringify(r.error)}`);
  const registry = r.value.registry;
  const campaign = registry.get('campaign', GEMINI_ID) as Campaign;
  return { registry, campaign };
}

export function startGemini(seed = 7): { engine: CampaignEngine; campaign: Campaign; registry: ReturnType<typeof geminiContent>['registry'] } {
  const { registry, campaign } = geminiContent();
  const engine = createCampaignEngine(registry);
  const r = engine.start({ campaign: GEMINI_ID, seed, faction: 'rfa', packs: {}, excludedTags: [], teams: [{ key: 'revenants' }, { key: 'pale-horse' }, { key: 'ironclad' }] });
  if (!r.ok) throw new Error(r.error);
  return { engine, campaign, registry };
}
