import { describe, expect, it, vi } from 'vitest';

vi.mock('../theme', () => ({ theme: { choice: 'dark', set: vi.fn() } }));

import { createAppContext } from '../../app';
import { bundle, fx, memStorage } from '../../app/__fixtures__';
import { AppState } from './app-context.svelte';

describe('AppState', () => {
  it('mirrors snapshot/settings and follows service changes', async () => {
    const state = new AppState();
    expect(state.status).toBe('loading');
    expect(() => state.ctx).toThrow(/not ready/);
    await state.boot(() => createAppContext(memStorage(), bundle(fx().other, fx().demo)));
    expect(state.status).toBe('ready');
    expect(state.isPersistent).toBe(false);
    expect(state.activeRulesetId).toBe('other-demo:alt');
    expect(state.loadErrors).toEqual([]);
    await state.ctx.settings.setActiveRuleset('demo:house');
    expect(state.settings?.activeRulesetId).toBe('demo:house');
    expect(state.activeRulesetId).toBe('demo:house');
    await state.ctx.library.setEnabled('demo', false);
    expect(state.registry?.get('unit', 'demo:lantern-wardens')).toBeUndefined();
  });

  it('reports startup failure', async () => {
    const state = new AppState();
    await state.boot(() => Promise.reject(new Error('boom')));
    expect(state).toMatchObject({ status: 'failed', error: 'boom' });
  });
});
