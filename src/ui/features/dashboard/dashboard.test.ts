// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '$lib/app';
import { bundle, clock, fx, ids, memStorage } from '$lib/app/__fixtures__';
import { router } from '../../router.svelte';
import Harness from './__fixtures__/Harness.svelte';

// The shared vitest config resolves `svelte` with node conditions (server build); components need
// the client runtime. TODO(architect): `resolve.conditions: ['browser']` for jsdom tests instead.
vi.mock('svelte', () => import('../../../../node_modules/svelte/src/index-client.js' as string));

// jsdom lacks modal dialogs.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};

const settle = async (ms = 30) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, ms / 5));
    await tick();
  }
};
const button = (root: HTMLElement, name: string | RegExp) =>
  [...root.querySelectorAll('button')].find((b) => (typeof name === 'string' ? b.textContent?.trim() === name : name.test(b.textContent ?? '')))!;

let app: ReturnType<typeof mount> | undefined;
afterEach(() => {
  if (app) unmount(app);
  app = undefined;
  document.body.innerHTML = '';
});

describe('dashboard page (smoke)', () => {
  it('lists games, opens the live board, and records taps as events', async () => {
    const ctx = await createAppContext(memStorage(), bundle(fx().other, fx().demo), { clock: clock(), newId: ids('s') });
    await ctx.settings.setActiveRuleset('demo:house');
    const r = await ctx.rosters.create({
      name: 'Ember Team',
      mode: 'matched',
      groups: [{ forceCardId: 'demo:lantern-detachment', handlerId: 'demo:warden-captain', unitIds: ['demo:lantern-wardens'] }],
    });
    const s = r.ok ? await ctx.sessions.create({ rosterId: r.value.roster.id, scenarioId: 'demo:lamp-recovery' }) : undefined;
    if (!s?.ok) throw new Error('setup');
    const id = s.value.record.id;

    router.query = {};
    const target = document.createElement('div');
    document.body.append(target);
    app = mount(Harness, { target, props: { boot: async () => ctx } });
    await settle();
    expect(target.querySelector('h1')?.textContent).toBe('Game');
    expect(target.textContent).toContain('Ember Team');
    expect(target.querySelector(`a[href="#/dashboard?session=${id}"]`)).not.toBeNull();

    router.query = { session: id };
    flushSync();
    await settle();
    expect(target.querySelector('h1')?.textContent).toBe('Ember Team');
    expect(target.textContent).toContain('Round 1 of 5');
    expect(target.textContent).toContain('Lamp Recovery');

    button(target, 'Next round').click();
    await settle();
    expect(target.textContent).toContain('Round 2 of 5');

    // Tap a model chip → sheet → mark destroyed.
    button(target, /^Lamplighter/).click();
    await settle();
    const destroyed = [...target.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.trim() === 'Destroyed')!;
    destroyed.click();
    await settle();
    const open = await ctx.sessions.open(id);
    expect(open.ok && open.value.state.units[1]!.models[0]!.status).toBe('destroyed');
    expect(open.ok && open.value.state.round).toBe(2);

    button(target, 'Undo').click();
    await settle();
    const after = await ctx.sessions.open(id);
    expect(after.ok && after.value.state.units[1]!.models[0]!.status).toBe('active');
  });
});
