// Emits docs/schema/pack.schema.json from the Zod schemas (single source of truth).
// Runs src/ through Vite's module runner so extensionless TS imports resolve without extra deps.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/schema/pack.schema.json');

const { module } = await runnerImport<typeof import('../src/packs/schema/json-schema')>(
  resolve(root, 'src/packs/schema/json-schema.ts'),
  { root, configFile: false, logLevel: 'error' },
);
const schema = module.packJsonSchema();
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`wrote ${out}`);
