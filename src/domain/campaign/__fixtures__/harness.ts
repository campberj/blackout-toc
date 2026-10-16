import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import type { ContentLookup } from '../../content';
import { createRng } from '../../rng/rng';
import type { Ctx, Scope } from '../context';
import { createCampaignEngine, type CampaignEngine } from '../engine';
import type { CampaignState } from '../state';
import { fireTrigger } from '../triggers';
import { enginePack } from './engine-pack';
import { lookupFromPacks } from './lookup';

export const content = (): ContentLookup => lookupFromPacks(demo, enginePack());

export const IRON = 'ops:iron-test';

/** Engine started on Iron Test with Alpha (+ Juno) and Bravo. */
export function ironEngine(seed = 1234, excludedTags: string[] = ['gore'], c: ContentLookup = content()): CampaignEngine {
  const e = createCampaignEngine(c);
  const r = e.start({
    campaign: IRON,
    seed,
    packs: { ops: '1.2.0' },
    excludedTags,
    teams: [{ key: 'alpha', recruits: [{ key: 'juno', name: 'Juno', fields: { role: 'medic' } }] }, { key: 'bravo' }],
  });
  if (!r.ok) throw new Error(r.error);
  return e;
}

/** Direct interpreter context over a clone of engine state (for unit-testing effects/conditions). */
export function ctxFor(e: CampaignEngine, c: ContentLookup = content()): Ctx {
  const s: CampaignState = structuredClone(e.state);
  const ctx: Ctx = {
    content: c,
    campaign: c.get('campaign', s.campaign!)!,
    s,
    rng: createRng(s.rngState),
    seq: 99,
    depth: 0,
    steps: 0,
    halted: false,
    fire: (on, info, scope) => fireTrigger(ctx, on, info, scope),
  };
  return ctx;
}

export const scope = (over: Partial<Scope> = {}): Scope => ({ participants: [], source: { type: 'manual', key: null }, ...over });

/** Dispatch and throw on rejection (keeps scripts terse). */
export function must(e: CampaignEngine, cmd: Parameters<CampaignEngine['dispatch']>[0]) {
  const r = e.dispatch(cmd);
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
  return r;
}

export const feedText = (s: CampaignState) => s.feed.map((f) => f.text);
