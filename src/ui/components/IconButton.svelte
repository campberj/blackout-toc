<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    icon: IconName;
    /** Required: the accessible name (also the tooltip). */
    label: string;
    variant?: 'ghost' | 'secondary';
  }

  let { icon, label, variant = 'ghost', type = 'button', ...rest }: Props = $props();
</script>

<button {type} class="icon-btn {variant}" aria-label={label} title={label} {...rest}>
  <Icon name={icon} />
</button>

<style>
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    color: var(--c-text);
    transition: background-color var(--dur-fast) var(--ease);
    touch-action: manipulation;
  }
  .secondary {
    background: var(--c-surface-2);
    border-color: var(--c-border-strong);
  }
  .icon-btn:not(:disabled):hover {
    background: var(--c-surface-3);
  }
  .icon-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
