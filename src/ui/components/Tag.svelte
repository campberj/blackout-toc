<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<span class="tag">{@render children()}</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    padding: 1px var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
    background: var(--c-surface-2);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
    white-space: nowrap;
  }
</style>
