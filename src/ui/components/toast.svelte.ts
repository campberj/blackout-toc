// App-wide toast queue. Rendered once by ToastHost in the shell.
export type ToastTone = 'ok' | 'warn' | 'crit' | 'info';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const DEFAULT_MS = 4000;

class ToastStore {
  items = $state<Toast[]>([]);
  #next = 1;
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Show a toast; returns its id. ms = 0 keeps it until dismissed. */
  push(message: string, tone: ToastTone = 'info', ms = DEFAULT_MS): number {
    const id = this.#next++;
    this.items.push({ id, message, tone });
    if (ms > 0) this.#timers.set(id, setTimeout(() => this.dismiss(id), ms));
    return id;
  }

  dismiss(id: number): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastStore();
