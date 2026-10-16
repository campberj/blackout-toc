<script lang="ts">
  import { readJsonFile } from '../state/files';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /*
   * JSON import from a file or pasted text. `onimport` receives the parsed file value or the raw
   * pasted string (services parse strings themselves) and returns error lines (empty = success).
   */
  interface Props {
    /** What is imported, e.g. "pack", "roster" (used in labels). */
    noun: string;
    onimport: (input: unknown) => Promise<string[]>;
  }

  let { noun, onimport }: Props = $props();

  const uid = $props.id();
  let pasting = $state(false);
  let text = $state('');
  let busy = $state(false);
  let errors = $state<string[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();

  async function run(input: () => Promise<unknown>) {
    busy = true;
    errors = [];
    try {
      errors = await onimport(await input());
      if (errors.length === 0) text = '';
    } catch (e) {
      errors = [e instanceof Error ? e.message : String(e)];
    } finally {
      busy = false;
    }
  }

  function onfile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (file) void run(() => readJsonFile(file));
  }
</script>

<div class="import">
  <div class="cluster">
    <input bind:this={fileInput} id="{uid}-file" class="sr-only" type="file" accept=".json,application/json" onchange={onfile} />
    <Button disabled={busy} onclick={() => fileInput?.click()}><Icon name="upload" size={18} />Import {noun} file</Button>
    <Button variant="ghost" aria-expanded={pasting} onclick={() => (pasting = !pasting)}>{pasting ? 'Hide paste box' : 'Paste JSON'}</Button>
  </div>

  {#if pasting}
    <label class="sr-only" for="{uid}-paste">Paste {noun} JSON</label>
    <textarea id="{uid}-paste" class="control mono" rows="6" placeholder={'{ "format": … }'} bind:value={text}></textarea>
    <div>
      <Button variant="primary" disabled={busy || !text.trim()} onclick={() => run(async () => text)}>Import pasted {noun}</Button>
    </div>
  {/if}

  {#if errors.length > 0}
    <div class="errors" role="alert">
      <p class="head"><Icon name="alert" size={16} />Import failed. Nothing was changed.</p>
      <ul role="list">
        {#each errors as e, i (i)}<li class="mono">{e}</li>{/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .import {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  textarea {
    font-size: var(--fs-sm);
  }
  .errors {
    padding: var(--sp-3);
    border-left: 3px solid var(--c-crit);
    background: color-mix(in srgb, var(--c-crit) 8%, transparent);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-crit);
    font-weight: var(--fw-bold);
  }
  ul {
    margin-top: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    font-size: var(--fs-sm);
    overflow-wrap: anywhere;
  }
</style>
