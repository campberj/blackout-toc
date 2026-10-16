// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('svelte', () => import('../../state/svelte-client'));
import { createAppContext, type AppContext } from '../../../app';
import { bundle, fx, memStorage } from '../../../app/__fixtures__';
import { router } from '../../router.svelte';
import { renderPage, settle } from '../../state/harness';
import RosterPage from './RosterPage.svelte';

let destroy = () => {};
afterEach(() => {
  destroy();
  router.query = {};
});

async function boot(): Promise<AppContext> {
  const ctx = await createAppContext(memStorage(), bundle(fx().other, fx().demo));
  await ctx.settings.setActiveRuleset('demo:house');
  return ctx;
}

describe('RosterPage', () => {
  it('shows the empty list with a new-roster action', async () => {
    const r = await renderPage(RosterPage, boot);
    destroy = r.destroy;
    expect(r.target.textContent).toContain('No rosters yet');
    expect(r.target.querySelector('a[href="#/roster?id=new"]')).not.toBeNull();
  });

  it('edits a saved roster with inline rule issues and a print sheet', async () => {
    const ctx = await boot();
    const saved = await ctx.rosters.create({ name: 'Lamp Team', mode: 'matched', groups: [{ forceCardId: 'demo:lantern-detachment', unitIds: ['demo:lantern-wardens'] }] });
    if (!saved.ok) throw new Error('create failed');
    router.query = { id: saved.value.roster.id };
    const r = await renderPage(RosterPage, async () => ctx);
    destroy = r.destroy;
    await settle();
    const text = r.target.textContent ?? '';
    expect((r.target.querySelector('input.control') as HTMLInputElement).value).toBe('Lamp Team');
    expect(text).toContain('each group needs a handler');
    expect(text).toContain('exactly 3 unit(s) per group required (has 1)');
    expect(r.target.querySelector('.print-roster-sheet')?.textContent).toContain('Lantern Detachment');
  });
});
