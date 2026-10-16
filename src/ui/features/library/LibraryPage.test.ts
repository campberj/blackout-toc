// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('svelte', () => import('../../state/svelte-client'));
import { createAppContext } from '../../../app';
import { bundle, fx, memStorage } from '../../../app/__fixtures__';
import { renderPage, settle } from '../../state/harness';
import LibraryPage from './LibraryPage.svelte';

let destroy = () => {};
afterEach(() => destroy());

describe('LibraryPage', () => {
  it('lists cards grouped by faction and packs on the packs tab', async () => {
    const r = await renderPage(LibraryPage, () => createAppContext(memStorage(), bundle(fx().other, fx().demo)));
    destroy = r.destroy;
    expect(r.target.textContent).toContain('Glasswing Cooperative');
    expect(r.target.textContent).toContain('Lantern Wardens');
    [...r.target.querySelectorAll<HTMLButtonElement>('[role=tab]')].find((t) => t.textContent?.includes('Packs'))!.click();
    await settle();
    expect(r.target.textContent).toContain('Demo Pack (invented content)');
    expect(r.target.querySelectorAll('[role=switch]')).toHaveLength(2);
  });

  it('offers one-tap recovery when the enabled set fails to load', async () => {
    const storage = memStorage();
    const ok = await createAppContext(storage, bundle(fx().other));
    const broken = fx().demo;
    broken.id = 'broken';
    broken.requires = [{ id: 'other-demo', range: '^1' }];
    await ok.library.import(broken);
    // Bundled base goes away → the stored pack's dependency fails at next start.
    const r = await renderPage(LibraryPage, () => createAppContext(storage, bundle()));
    destroy = r.destroy;
    expect(r.target.textContent).toContain('Packs failed to load');
    const btn = [...r.target.querySelectorAll('button')].find((b) => b.textContent?.includes('Disable'))!;
    expect(btn.textContent).toContain('Demo Pack');
    btn.click();
    await settle();
    expect(r.target.textContent).not.toContain('Packs failed to load');
  });
});
