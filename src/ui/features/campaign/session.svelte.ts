import type { CampaignService, OpenCampaign } from '../../../app';
import type { CampaignCommandInput, CampaignEvent, CampaignState } from '$lib/domain/campaign';
import type { ContentLookup } from '$lib/domain/content';
import type { Campaign, Id } from '$lib/packs/schema';
import type { Result } from '$lib/domain/result';

// One open campaign save for the #/campaign?save=… screens. Thin: every rule lives in the service/engine.

export class CampaignSession {
  open = $state.raw<OpenCampaign | null>(null);
  error = $state<string | null>(null);
  loading = $state(true);
  busy = $state(false);

  readonly #svc: CampaignService;
  readonly #lookup: () => ContentLookup | null;
  readonly id: string;

  constructor(svc: CampaignService, id: string, lookup: () => ContentLookup | null) {
    this.#svc = svc;
    this.id = id;
    this.#lookup = lookup;
  }

  get state(): CampaignState | null {
    return this.open?.state ?? null;
  }

  /** Campaign definition from loaded content (undefined when its pack is gone). */
  get campaign(): Campaign | undefined {
    const id = this.open?.state.campaign;
    return id ? this.#lookup()?.get('campaign', id as Id) : undefined;
  }

  async load(): Promise<void> {
    this.loading = true;
    const r = await this.#svc.open(this.id);
    this.loading = false;
    if (r.ok) {
      this.open = r.value;
      this.error = null;
    } else {
      this.error = r.error;
    }
  }

  /** Dispatch; on success the session holds the new state. Returns the command's events. */
  async run(command: CampaignCommandInput): Promise<Result<CampaignEvent[], string>> {
    this.busy = true;
    try {
      // Commands are persisted: strip Svelte proxies (IndexedDB can't clone them).
      const r = await this.#svc.dispatch(this.id, $state.snapshot(command) as CampaignCommandInput);
      if (!r.ok) return r;
      const { events, ...open } = r.value;
      this.open = open;
      return { ok: true, value: events };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      this.busy = false;
    }
  }

  preview(command: CampaignCommandInput) {
    return this.#svc.preview(this.id, $state.snapshot(command) as CampaignCommandInput);
  }

  async undo(): Promise<Result<true, string>> {
    this.busy = true;
    try {
      const r = await this.#svc.undo(this.id);
      if (!r.ok) return r;
      this.open = r.value;
      return { ok: true, value: true };
    } finally {
      this.busy = false;
    }
  }

  async rename(name: string): Promise<Result<true, string>> {
    const r = await this.#svc.rename(this.id, name);
    if (!r.ok) return r;
    await this.load();
    return { ok: true, value: true };
  }
}
