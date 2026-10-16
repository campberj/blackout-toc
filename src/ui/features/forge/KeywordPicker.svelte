<script lang="ts">
  import type { KeywordRef, Keyword } from '$lib/packs/schema';
  import Button from '../../components/Button.svelte';
  import IconButton from '../../components/IconButton.svelte';

  /* Keyword refs from loaded definitions only (unresolved keys are a Forge error). */
  interface Props {
    label: string;
    refs: KeywordRef[];
    keywords: readonly Keyword[];
    appliesTo: 'weapon' | 'model';
    /** Message per ref index (e.g. unresolved). */
    errorAt?: (i: number) => string | undefined;
  }

  let { label, refs = $bindable(), keywords, appliesTo, errorAt }: Props = $props();

  const uid = $props.id();
  const available = $derived(keywords.filter((k) => k.appliesTo === appliesTo).sort((a, b) => a.name.localeCompare(b.name)));
  let pick = $state('');
  let x = $state<number | null>(1);
  const picked = $derived(available.find((k) => k.id === pick));

  const nameOf = (r: KeywordRef) => keywords.find((k) => k.id === r.key)?.name ?? r.key;

  function add() {
    if (!picked) return;
    refs = [...refs, picked.param === 'X' && typeof x === 'number' ? { key: picked.id, x } : { key: picked.id }];
    pick = '';
  }
</script>

<div class="kp" role="group" aria-labelledby="{uid}-l">
  <span id="{uid}-l" class="label">{label}</span>
  {#if refs.length > 0}
    <ul class="refs" role="list">
      {#each refs as r, i (i)}
        {@const err = errorAt?.(i)}
        <li class:bad={!!err}>
          <span>{nameOf(r)}{r.x === undefined ? '' : ` (${r.x})`}</span>
          {#if err}<span class="err">{err}</span>{/if}
          <IconButton icon="close" label="Remove {nameOf(r)}" onclick={() => (refs = refs.filter((_, j) => j !== i))} />
        </li>
      {/each}
    </ul>
  {/if}
  {#if available.length === 0}
    <p class="none">No {appliesTo} keywords are loaded.</p>
  {:else}
    <div class="add">
      <label class="sr-only" for="{uid}-s">Keyword to add</label>
      <select id="{uid}-s" class="control" bind:value={pick}>
        <option value="">Add keyword…</option>
        {#each available as k (k.id)}<option value={k.id}>{k.name}{k.param ? ' (X)' : ''}</option>{/each}
      </select>
      {#if picked?.param === 'X'}
        <label class="sr-only" for="{uid}-x">{picked.name} value</label>
        <input id="{uid}-x" class="control mono x" type="number" min="0" max="99" inputmode="numeric" bind:value={x} />
      {/if}
      <Button disabled={!picked} onclick={add}>Add</Button>
    </div>
  {/if}
</div>

<style>
  .kp {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .label {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }
  .refs li {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-1);
    padding-left: var(--sp-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    background: var(--c-surface-2);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .refs li.bad {
    border-color: var(--c-crit);
  }
  .err {
    color: var(--c-crit);
    font-weight: var(--fw-regular);
  }
  .add {
    display: flex;
    gap: var(--sp-2);
  }
  .add select {
    flex: 1;
    min-width: 0;
  }
  .x {
    width: 5rem;
  }
  .none {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
