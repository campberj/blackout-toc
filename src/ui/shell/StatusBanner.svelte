<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IconButton from '../components/IconButton.svelte';
  import type { IconName } from '../components/icons';

  /* Non-blocking app-level notice (storage fallback, pack load errors). Dismissible. */
  interface Props {
    tone?: 'warn' | 'crit';
    icon?: IconName;
    message: string;
  }
  let { tone = 'warn', icon = 'alert', message }: Props = $props();
  let open = $state(true);
</script>

{#if open}
  <div class="status no-print {tone}" role="status">
    <Icon name={icon} size={18} />
    <p>{message}</p>
    <IconButton icon="close" label="Dismiss" onclick={() => (open = false)} />
  </div>
{/if}

<style>
  .status {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 0 var(--sp-2) 0 var(--gutter);
    border-bottom: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--tone) 14%, var(--c-surface-1));
    color: var(--c-text);
    font-size: var(--fs-sm);
  }
  .warn {
    --tone: var(--c-warn);
  }
  .crit {
    --tone: var(--c-crit);
  }
  .status > :global(svg) {
    flex: none;
    color: var(--tone);
  }
  p {
    flex: 1;
    max-width: none;
    padding: var(--sp-2) 0;
  }
</style>
