// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('svelte', () => import('../../state/svelte-client'));
import { createAppContext, createStorage, type AppContext } from '../../../app';
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
    expect(r.target.textContent).toContain('Full backup isn’t available');
    const select = r.target.querySelector('select') as HTMLSelectElement;
    select.value = 'demo:house';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const chip = [...r.target.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find((b) => b.textContent?.trim() === 'fiction')!;
    chip.click();
    await settle();
    expect(ctx.settings.current).toMatchObject({ activeRulesetId: 'demo:house', excludedTags: ['fiction'] });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('restores a backup file after choosing replace', async () => {
    const src = await createStorage({ inMemory: true });
    const a = await createAppContext(src.storage, bundle(fx().other, fx().demo), { backup: src.backup });
    await a.settings.setExcludedTags(['fiction']);
    await a.rosters.create({ name: 'Backed up', mode: 'matched' });
    const json = JSON.stringify(await src.backup.exportAll());

    const dst = await createStorage({ inMemory: true });
    let b!: AppContext;
    const r = await renderPage(SettingsPage, async () => (b = await createAppContext(dst.storage, bundle(fx().other, fx().demo), { backup: dst.backup })));
    destroy = r.destroy;
    await b.rosters.create({ name: 'Local only', mode: 'matched' });

    const input = r.target.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File([json], 'backup.json')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(10);
    expect(document.querySelector('dialog')?.textContent).toContain('1 roster');
    document.querySelector<HTMLInputElement>('input[value=replace]')!.click();
    await settle();
    [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Replace all data'))!.click();
    await settle(10);

    expect((await b.rosters.list()).map((x) => x.name)).toEqual(['Backed up']);
    expect(b.settings.current.excludedTags).toEqual(['fiction']);
    expect(r.target.textContent).toContain('Replaced all data with');
    expect(r.target.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.textContent?.trim()).toBe('fiction');
  });
});
