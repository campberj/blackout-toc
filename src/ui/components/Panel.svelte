<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** Heading level so panels nest correctly in the page outline. */
    level?: 2 | 3 | 4;
    /** Optional right-aligned header content (badges, actions). */
    actions?: Snippet;
    children: Snippet;
    id?: string;
  }

  let { title, level = 2, actions, children, id }: Props = $props();
  const uid = $props.id();
  const headingId = $derived(id ? `${id}-h` : `panel-${uid}`);
</script>

<section class="panel print-avoid-break" aria-labelledby={headingId} {id}>
  <header class="head">
    <svelte:element this={`h${level}`} id={headingId} class="title">{title}</svelte:element>
    {#if actions}
      <div class="actions">{@render actions()}</div>
    {/if}
  </header>
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .panel {
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-top: 2px solid var(--c-border-strong);
    border-radius: var(--r-xs);
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    min-height: var(--touch);
    padding: var(--sp-1) var(--sp-2) var(--sp-1) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
  }
  .title {
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    letter-spacing: 0.01em;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .body {
    padding: var(--sp-4);
  }
</style>
