<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes } from 'svelte/elements';

  /* Navigation styled as a button (in-app hash links). Use Button for actions. */
  interface Props extends HTMLAnchorAttributes {
    href: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    children: Snippet;
  }

  let { href, variant = 'secondary', children, ...rest }: Props = $props();
</script>

<a {href} class="lbtn {variant}" {...rest}>{@render children()}</a>

<style>
  .lbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-4);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    font-weight: var(--fw-medium);
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    color: var(--c-text);
  }
  .lbtn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .primary {
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
  .primary:hover {
    background: var(--c-accent-strong);
  }
  .secondary {
    background: var(--c-surface-2);
    border-color: var(--c-border-strong);
  }
  .secondary:hover,
  .ghost:hover {
    background: var(--c-surface-3);
  }
</style>
