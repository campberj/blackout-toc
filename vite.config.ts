import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves at /<repo>/. Override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/blackout-toc/',
  plugins: [svelte()],
  resolve: { alias: { $lib: fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/domain/**', 'src/packs/**', 'src/app/**'] },
  },
});
