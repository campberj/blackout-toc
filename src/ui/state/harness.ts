import { flushSync, mount, tick, unmount, type Component } from 'svelte';
import type { AppContext } from '../../app';
import AppStateHarness from './AppStateHarness.svelte';

// jsdom smoke-test helper: mount a page under a real AppState and wait for async boot + loads.

export async function settle(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await tick();
  }
  flushSync();
}

export async function renderPage(page: Component, boot: () => Promise<AppContext>): Promise<{ target: HTMLElement; destroy: () => void }> {
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(AppStateHarness, { target, props: { boot, page } });
  await settle();
  return {
    target,
    destroy: () => {
      void unmount(app);
      target.remove();
    },
  };
}
