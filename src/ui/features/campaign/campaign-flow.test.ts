// Integration: GEMINI through the wizard model → FIRST LIGHT briefing selection → AAR form → preview → resolve → debrief,
// on the real reference pack and the in-memory AppContext (no DOM).
import { describe, expect, it } from 'vitest';
import { createAppContext } from '../../../app';
import { bundle, clock, ids, memStorage } from '../../../app/__fixtures__';
import { campaignOptions, initWizard, toCreateInput, validateAll } from './model/wizard';
import { missionCards } from './model/missions';
import { selectionWarnings, teamViews } from './model/roster';
import { initAarDraft, toAarInput, validateAarDraft } from './model/aar';
import { diffStates } from './model/preview';
import { debriefView, groupFeed } from './model/feed';
import { stageView } from './model/stage';
import { geminiRaw } from './model/__fixtures__/gemini';
import type { Campaign, Id } from '$lib/packs/schema';

const must = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`Expected ok: ${JSON.stringify(r.error)}`);
  return r.value;
};

describe('campaign flow: GEMINI → FIRST LIGHT', () => {
  it('wizard → create → brief → AAR (pre-filled) → preview → resolve → debrief', async () => {
    const ctx = await createAppContext(memStorage(), bundle(geminiRaw()), { clock: clock(), newId: ids('save'), newSeed: () => 42 });
    const registry = ctx.snapshot().registry;

    // Wizard
    const [option] = campaignOptions(registry);
    const campaign = registry.get('campaign', option!.id as Id) as Campaign;
    const draft = { ...initWizard(campaign), name: 'Gemini test' };
    expect(validateAll(campaign, draft)).toEqual([]);
    const opened = must(await ctx.campaigns.create(toCreateInput(draft)));
    const id = opened.save.id;
    expect(opened.state.faction).toBe('rfa');

    // Opening orders = the start command's traffic
    const opening = debriefView(opened.state.feed, opened.save.events, 1);
    expect(opening.kind).toBe('opening');
    expect(opening.traffic.some((e) => e.speaker?.callsign === 'MONOLITH')).toBe(true);

    // Operations center
    expect(stageView(campaign, opened.state)).toMatchObject({ number: 1, required: 2, resolvedRequired: 0 });
    const cards = missionCards(campaign, opened.state, opened.available, registry);
    expect(cards.map((c) => c.key)).toEqual(['first-light', 'tripwire']);

    // Briefing: rendered via dry-run beginMission, then operator selection
    const brief = must(await ctx.campaigns.preview(id, { type: 'beginMission', mission: 'first-light' }));
    expect(brief.state.feed.some((f) => f.source.type === 'briefing' && f.title === 'FIRST LIGHT')).toBe(true);
    const selected = ['acheron', 'voss'];
    expect(selectionWarnings(teamViews(campaign, opened.state), selected)).toEqual([]);

    // AAR with a dashboard pre-fill (none pending here → bridge returns undefined; form uses the selection)
    const prefill = await ctx.gameBridge.prefillFor(id, 'first-light');
    const def = campaign.missions.find((m) => m.key === 'first-light')!;
    const aar = initAarDraft(campaign, opened.state, 'first-light', { selected, prefill })!;
    aar.outcome = 'success';
    aar.fields['vp'] = 6;
    aar.operators['acheron']!.kills = 2;
    aar.operators['acheron']!.fields['casualty'] = 'serious';
    aar.operators['voss']!.kills = 1;
    expect(validateAarDraft(def, aar)).toEqual([]);

    // Preview: nothing persisted, changes visible
    const pv = must(await ctx.campaigns.preview(id, { type: 'resolveAar', aar: toAarInput(aar) }));
    const diff = diffStates(campaign, opened.state, pv.state);
    expect(diff.operators.find((o) => o.key === 'acheron')!.ladders[0]!.to.label).toBe('Serious Wound');
    expect(diff.teams[0]!.ladders[0]!.to.label).toBe('RED');
    expect(diff.tracks.find((t) => t.key === 'stability')).toMatchObject({ from: 5, to: 6 });
    expect(must(await ctx.campaigns.open(id)).save.events).toHaveLength(1);

    // Resolve, consume, debrief
    const resolved = must(await ctx.campaigns.dispatch(id, { type: 'resolveAar', aar: toAarInput(aar) }));
    await ctx.gameBridge.consume(id, 'first-light');
    const from = resolved.events[0]!.seq;
    const debrief = debriefView(resolved.state.feed, resolved.save.events, from);
    expect(debrief.kind).toBe('debrief');
    expect(debrief.traffic.map((e) => e.source.type)).toEqual(['outcome', 'debrief']);
    expect(resolved.state.operators['acheron']!.stats).toMatchObject({ xp: 5, kills: 2, missions: 1 });
    expect(resolved.available.map((m) => m.key)).toEqual(['tripwire']);
    expect(stageView(campaign, resolved.state)!.resolvedRequired).toBe(1);
    expect(groupFeed(resolved.state.feed, resolved.save.events)[0]!.label).toBe('After-action report');

    // Undo is per command: back to the start
    const undone = must(await ctx.campaigns.undo(id));
    expect(undone.save.events).toHaveLength(1);
    expect(undone.available.map((m) => m.key)).toEqual(['first-light', 'tripwire']);
  });
});
