// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('svelte', () => import('../../state/svelte-client'));
import { createAppContext, type AppContext } from '../../../app';
import { bundle, fx, memStorage } from '../../../app/__fixtures__';
import { renderPage, settle } from '../../state/harness';
import SettingsPage from './SettingsPage.svelte';

let destroy = () => {};
afterEach(() => destroy());

describe('SettingsPage', () => {
  it('changes ruleset, excludes tags and warns about non-persistent storage', async () => {
    let ctx!: AppContext;
    const r = await renderPage(SettingsPage, async () => (ctx = await createAppContext(memStorage(), bundle(fx().other, fx().demo))));
    destroy = r.destroy;
    expect(r.target.textContent).toContain('Not saved');
    const select = r.target.querySelector('select') as HTMLSelectElement;
    select.value = 'demo:house';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const chip = [...r.target.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find((b) => b.textContent?.trim() === 'fiction')!;
    chip.click();
    await settle();
    expect(ctx.settings.current).toMatchObject({ activeRulesetId: 'demo:house', excludedTags: ['fiction'] });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });
});
