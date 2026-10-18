import type { CustomContact, GameCommandInput, GameRejection, OpenSession, SessionService, Side } from '$lib/app';
import type { Result } from '$lib/domain/result';
import type { AarPrefill } from '$lib/app';
import { toasts } from '../../components/toast.svelte';

// Live board controller: one session, every change goes through the service (write-through).
// Overridable blocks (caps, round limit) ask for confirmation, then resend with `force`.

export interface PendingForce {
  readonly command: GameCommandInput;
  readonly message: string;
}

export class BoardController {
  session = $state.raw<OpenSession | null>(null);
  error = $state<string | null>(null);
  pending = $state.raw<PendingForce | null>(null);
  /** Bumped after a refused tap so self-updating controls (pips) resync to state. */
  rev = $state(0);
  busy = $state(false);

  readonly #sessions: SessionService;
  readonly id: string;

  constructor(sessions: SessionService, id: string) {
    this.#sessions = sessions;
    this.id = id;
  }

  get state() {
    return this.session?.state ?? null;
  }

  async load(): Promise<void> {
    const r = await this.#sessions.open(this.id);
    if (r.ok) {
      this.session = r.value;
      this.error = null;
    } else this.error = r.error;
  }

  #settle(r: Result<OpenSession & { warnings?: readonly { message: string }[] }, GameRejection>, command?: GameCommandInput): boolean {
    if (r.ok) {
      this.session = r.value;
      for (const w of r.value.warnings ?? []) toasts.push(w.message, 'warn');
      return true;
    }
    this.rev++;
    if (r.error.overridable && command) this.pending = { command, message: r.error.message };
    else toasts.push(r.error.message, 'crit');
    return false;
  }

  async run(command: GameCommandInput): Promise<boolean> {
    // Commands are persisted: strip Svelte proxies (IndexedDB can't clone them).
    const plain = $state.snapshot(command) as typeof command;
    return this.#settle(await this.#sessions.dispatch(this.id, plain), plain);
  }

  async confirmForce(): Promise<boolean> {
    const p = this.pending;
    this.pending = null;
    return p ? this.run({ ...p.command, force: true } as GameCommandInput) : false;
  }

  async undo(): Promise<void> {
    const label = this.undoLabel;
    const r = await this.#sessions.undo(this.id);
    if (r.ok) {
      this.session = r.value;
      toasts.push(`Undone: ${label}`, 'info', 2500);
    } else toasts.push(r.error, 'info');
  }

  /** Newest log line (what Undo removes); null when only the start remains. */
  get undoLabel(): string | null {
    const log = this.session?.log ?? [];
    const last = log.at(-1);
    if (!last || last.cmd === log[0]!.cmd) return null;
    return log
      .filter((l) => l.cmd === last.cmd)
      .map((l) => l.text)
      .join('; ');
  }

  async quickAdd(side: Side, unitId: string, count: number): Promise<boolean> {
    return this.#settle(await this.#sessions.quickAdd(this.id, side, unitId as never, count));
  }

  async addContact(side: Side, contact: CustomContact): Promise<boolean> {
    return this.#settle(await this.#sessions.addContact(this.id, side, contact));
  }

  async end(): Promise<AarPrefill | undefined | false> {
    const r = await this.#sessions.end(this.id);
    if (!this.#settle(r)) return false;
    return r.ok ? r.value.prefill : undefined;
  }
}
