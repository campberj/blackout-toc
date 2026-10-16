<script lang="ts" module>
  export interface ChipOption {
    value: string;
    label: string;
  }
</script>

<script lang="ts">
  /* Multi-select toggle chips (filters, excluded tags). Each chip is a 44px toggle button. */
  interface Props {
    label: string;
    options: readonly ChipOption[];
    selected: readonly string[];
    onchange: (next: string[]) => void;
    /** Visual intent of an active chip: include (accent) or exclude (struck through). */
    mode?: 'include' | 'exclude';
  }

  let { label, options, selected, onchange, mode = 'include' }: Props = $props();

  function toggle(v: string) {
    onchange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }
</script>

<div class="chips {mode}" role="group" aria-label={label}>
  {#each options as o (o.value)}
    {@const on = selected.includes(o.value)}
    <button type="button" class="chip" class:on aria-pressed={on} onclick={() => toggle(o.value)}>
      <span class="box" aria-hidden="true"></span>{o.label}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    background: var(--c-surface-2);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    touch-action: manipulation;
  }
  .chip:hover {
    color: var(--c-text);
  }
  .chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .box {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid currentColor;
    border-radius: var(--r-xs);
  }
  .include .on {
    border-color: var(--c-accent);
    color: var(--c-text);
    background: color-mix(in srgb, var(--c-accent) 14%, var(--c-surface-2));
  }
  .include .on .box {
    background: var(--c-accent);
    border-color: var(--c-accent);
  }
  .exclude .on {
    border-color: var(--c-crit);
    color: var(--c-text);
    text-decoration: line-through;
    background: color-mix(in srgb, var(--c-crit) 10%, var(--c-surface-2));
  }
  .exclude .on .box {
    background: var(--c-crit);
    border-color: var(--c-crit);
  }
</style>
