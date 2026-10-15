<script lang="ts">
  import type { Snippet } from 'svelte';

  /* Page frame: h1 + one-line purpose + content. Every route renders exactly one. */
  interface Props {
    title: string;
    purpose: string;
    actions?: Snippet;
    children?: Snippet;
  }
  let { title, purpose, actions, children }: Props = $props();
</script>

<div class="page">
  <header class="ph">
    <div>
      <h1 class="title">{title}</h1>
      <p class="purpose">{purpose}</p>
    </div>
    {#if actions}<div class="actions no-print">{@render actions()}</div>{/if}
  </header>
  {#if children}{@render children()}{/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .ph {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--sp-3);
    padding-bottom: var(--sp-4);
    border-bottom: 1px solid var(--c-border);
  }
  .title {
    font-size: var(--fs-2xl);
  }
  .purpose {
    margin-top: var(--sp-1);
    color: var(--c-text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
</style>
