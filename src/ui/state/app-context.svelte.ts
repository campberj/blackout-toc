import { getContext, setContext } from 'svelte';
import { createAppContext, createStorage, formatLoadErrors, type AppContext, type AppSettings, type LibrarySnapshot } from '../../app';
import { theme } from '../theme';
import { bundledPacks } from './bundled-packs';

// Reactive mirror of the app context for components. Features call services via `app.ctx`;
// registry/settings changes flow back through service subscriptions.

const KEY = Symbol('blkout.app');

export type AppStatus = 'loading' | 'ready' | 'failed';

export class AppState {
  status = $state<AppStatus>('loading');
  /** Startup failure message (status = failed). */
  error = $state<string | null>(null);
  isPersistent = $state(true);
  context = $state.raw<AppContext | null>(null);
  snapshot = $state.raw<LibrarySnapshot | null>(null);
  settings = $state.raw<AppSettings | null>(null);

  readonly registry = $derived(this.snapshot?.registry ?? null);
  /** Human-readable pack load errors (non-empty ⇒ registry is empty). */
  readonly loadErrors = $derived(formatLoadErrors(this.snapshot?.errors ?? []));
  readonly activeRulesetId = $derived.by(() => {
    void this.settings; // re-resolve on settings change
    return this.context && this.registry ? this.context.settings.resolveRuleset(this.registry) : undefined;
  });

  /** Services; throws before startup completes (check `status === 'ready'`). */
  get ctx(): AppContext {
    if (!this.context) throw new Error('App context is not ready');
    return this.context;
  }

  attach(ctx: AppContext): () => void {
    this.context = ctx;
    this.isPersistent = ctx.isPersistent;
    this.snapshot = ctx.snapshot();
    this.settings = ctx.settings.current;
    const offs = [ctx.library.subscribe((s) => (this.snapshot = s)), ctx.settings.subscribe((s) => (this.settings = s))];
    this.status = 'ready';
    return () => offs.forEach((off) => off());
  }

  async boot(make: () => Promise<AppContext>): Promise<void> {
    try {
      this.attach(await make());
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.status = 'failed';
    }
  }
}

/** Browser composition: IndexedDB (memory fallback) + bundled packs + UI theme store. */
export async function bootApp(): Promise<AppContext> {
  const { storage } = await createStorage();
  return createAppContext(storage, bundledPacks, { theme: { get: () => theme.choice, set: (c) => theme.set(c) } });
}

/** Call once from the root component's init. */
export function provideAppState(boot: () => Promise<AppContext> = bootApp): AppState {
  const state = new AppState();
  setContext(KEY, state);
  void state.boot(boot);
  return state;
}

export function useAppState(): AppState {
  const state = getContext<AppState | undefined>(KEY);
  if (!state) throw new Error('useAppState() called outside the app root');
  return state;
}
