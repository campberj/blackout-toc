// App-layer ports injected by the composition root (UI supplies browser implementations).

/** First-party packs shipped with the app (raw JSON). Vite globbing lives in the UI layer. */
export interface BundledPackSource {
  load(): Promise<readonly unknown[]>;
}

/** New record ids (default: crypto.randomUUID). */
export type IdSource = () => string;
/** Campaign seeds, uint32 (domain never reads entropy). */
export type SeedSource = () => number;

export type ThemeChoice = 'dark' | 'light' | 'system';
/** Theme stays a per-device preference owned by the UI theme store; settings only pass it through. */
export interface ThemePort {
  get(): ThemeChoice;
  set(choice: ThemeChoice): void;
}

export const randomId: IdSource = () => crypto.randomUUID();
export const randomSeed: SeedSource = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
export const emptyBundle: BundledPackSource = { load: async () => [] };
