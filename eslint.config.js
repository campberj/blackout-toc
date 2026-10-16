import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.svelte', '**/*.svelte.ts'], languageOptions: { parserOptions: { parser: ts.parser } } },
  // Domain must stay pure + deterministic (DESIGN §3, §12).
  {
    files: ['src/domain/**/*.ts', 'src/packs/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use domain/rng (seeded) for replay determinism.' }],
      'no-restricted-globals': ['error', 'indexedDB', 'localStorage', 'document', 'window', 'fetch'],
      'no-restricted-imports': ['error', { patterns: ['svelte', 'svelte/*', '*.svelte', '**/adapters/**', '**/ui/**'] }],
    },
  },
  // App layer may use ports/domain/packs, never UI (dependencies point inward — DESIGN §3).
  {
    files: ['src/app/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['svelte', 'svelte/*', '*.svelte', '**/ui/**'] }] },
  },
);
