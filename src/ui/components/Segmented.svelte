<script lang="ts" module>
  export interface SegmentOption<T extends string = string> {
    value: T;
    label: string;
  }
</script>

<script lang="ts" generics="T extends string">
  /*
   * Single-choice button row (radio semantics). Stateless: shows `value`, reports picks via
   * `onchange`; the caller owns the state (event-sourced screens).
   */
  interface Props {
    label: string;
    options: readonly SegmentOption<T>[];
    value: T | null;
    /** Wrap into a grid instead of one row (long option lists). */
    wrap?: boolean;
    onchange: (value: T) => void;
  }

  let { label, options, value, wrap = false, onchange }: Props = $props();
  let buttons: HTMLButtonElement[] = $state([]);

  function onkeydown(e: KeyboardEvent) {
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in step)) return;
    e.preventDefault();
    const next = (i + step[e.key]! + options.length) % options.length;
    onchange(options[next]!.value);
    buttons[next]?.focus();
  }
</script>

<div class="seg" class:wrap role="radiogroup" aria-label={label} tabindex="-1" {onkeydown}>
  {#each options as o, i (o.value)}
    <button
      bind:this={buttons[i]}
      type="button"
      role="radio"
      aria-checked={o.value === value}
      tabindex={o.value === value || (value === null && i === 0) ? 0 : -1}
      onclick={() => o.value !== value && onchange(o.value)}
    >
      {o.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    background: var(--c-surface-2);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
  }
  .seg:focus {
    outline: none;
  }
  .wrap {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  }
  button {
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border-radius: 2px;
    color: var(--c-text-muted);
    font-weight: var(--fw-medium);
    white-space: nowrap;
    touch-action: manipulation;
  }
  button:not([aria-checked='true']):hover {
    background: var(--c-surface-3);
    color: var(--c-text);
  }
  button[aria-checked='true'] {
    background: var(--c-accent);
    color: var(--c-on-accent);
    font-weight: var(--fw-bold);
  }
  button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
