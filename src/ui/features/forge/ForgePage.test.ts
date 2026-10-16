// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('svelte', () => import('../../state/svelte-client'));
import { createAppContext } from '../../../app';
import { bundle, draft, fx, memStorage } from '../../../app/__fixtures__';
import { router } from '../../router.svelte';
import { renderPage, settle } from '../../state/harness';
import ForgePage from './ForgePage.svelte';

let destroy = () => {};
afterEach(() => {
  destroy();
  router.query = {};
});

const boot = async () => {
  const ctx = await createAppContext(memStorage(), bundle(fx().other, fx().demo));
  await ctx.settings.setActiveRuleset('demo:house');
  return ctx;
};

describe('ForgePage', () => {
  it('blocks saving a new unit until errors are fixed', async () => {
    router.query = { id: 'new' };
    const r = await renderPage(ForgePage, boot);
    destroy = r.destroy;
    const save = [...r.target.querySelectorAll('button')].find((b) => b.textContent?.includes('Create unit'))!;
    expect(save.disabled).toBe(true);
    const name = r.target.querySelector('input.control') as HTMLInputElement;
    name.value = 'Night Wardens';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const weapon = [...r.target.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Weapon name'))!;
    const wi = r.target.querySelector(`#${weapon.htmlFor}`) as HTMLInputElement;
    wi.value = 'Lamp Gun';
    wi.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(save.disabled).toBe(false);
    expect(r.target.querySelector('.preview')?.textContent).toContain('Night Wardens');
  });

  it('lists saved custom units', async () => {
    const ctx = await boot();
    await ctx.customUnits.create(draft());
    const r = await renderPage(ForgePage, async () => ctx);
    destroy = r.destroy;
    expect(r.target.textContent).toContain('Edit Night Wardens');
  });
});
