<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    title: string;
    message?: string;
    icon?: IconName;
    /** The next step (usually one primary Button). */
    action?: Snippet;
  }

  let { title, message, icon = 'grid', action }: Props = $props();
</script>

<div class="empty">
  <span class="glyph"><Icon name={icon} size={28} /></span>
  <h3 class="title">{title}</h3>
  {#if message}<p class="msg">{message}</p>{/if}
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-6) var(--sp-5);
    border: 1px dashed var(--c-border-strong);
    border-radius: var(--r-xs);
  }
  .glyph {
    color: var(--c-text-muted);
  }
  .title {
    font-size: var(--fs-lg);
  }
  .msg {
    color: var(--c-text-muted);
  }
  .action {
    margin-top: var(--sp-2);
  }
</style>
