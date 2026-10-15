<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: 'md' | 'lg';
    block?: boolean;
    children: Snippet;
  }

  let { variant = 'secondary', size = 'md', block = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class="btn {variant} {size}" class:block {...rest}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    min-width: var(--touch);
    padding: 0 var(--sp-4);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    font-weight: var(--fw-medium);
    font-size: var(--fs-md);
    line-height: 1;
    white-space: nowrap;
    transition:
      background-color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
    touch-action: manipulation;
  }
  .lg {
    min-height: var(--touch-lg);
    padding: 0 var(--sp-5);
    font-size: var(--fs-lg);
  }
  .block {
    display: flex;
    width: 100%;
  }
  .btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .primary {
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
  .primary:not(:disabled):hover {
    background: var(--c-accent-strong);
  }

  .secondary {
    background: var(--c-surface-2);
    border-color: var(--c-border-strong);
    color: var(--c-text);
  }
  .secondary:not(:disabled):hover {
    background: var(--c-surface-3);
  }

  .ghost {
    color: var(--c-text);
  }
  .ghost:not(:disabled):hover {
    background: var(--c-surface-2);
  }

  .danger {
    background: transparent;
    border-color: var(--c-crit);
    color: var(--c-crit);
  }
  .danger:not(:disabled):hover {
    background: color-mix(in srgb, var(--c-crit) 14%, transparent);
  }
</style>
