// Svelte's browser runtime for jsdom page tests: vite.config has no `browser` resolve condition under
// vitest, so `svelte` resolves to the server entry. Tests: vi.mock('svelte', () => import(this file)).
// @ts-expect-error package-internal entry has no declaration file
export * from '../../../node_modules/svelte/src/index-client.js';
