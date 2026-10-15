<script lang="ts">
  import IconButton from './IconButton.svelte';

  interface Props {
    label: string;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    onchange?: (value: number) => void;
  }

  let {
    label,
    value = $bindable(0),
    min = 0,
    max = Number.POSITIVE_INFINITY,
    step = 1,
    onchange,
  }: Props = $props();

  const uid = $props.id();

  function set(v: number) {
    const next = Math.max(min, Math.min(max, v));
    if (next === value) return;
    value = next;
    onchange?.(next);
  }
</script>

<div class="counter" role="group" aria-labelledby="{uid}-l">
  <span id="{uid}-l" class="label">{label}</span>
  <div class="row">
    <IconButton icon="minus" variant="secondary" label="Decrease {label}" disabled={value <= min} onclick={() => set(value - step)} />
    <output class="value mono" aria-live="polite" aria-atomic="true">
      {value}{#if Number.isFinite(max)}<span class="max">/{max}</span>{/if}
    </output>
    <IconButton icon="plus" variant="secondary" label="Increase {label}" disabled={value >= max} onclick={() => set(value + step)} />
  </div>
</div>

<style>
  .counter {
    display: inline-flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .label {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .value {
    min-width: 4ch;
    text-align: center;
    font-size: var(--fs-2xl);
    font-weight: var(--fw-bold);
    line-height: 1;
  }
  .max {
    color: var(--c-text-muted);
    font-size: var(--fs-md);
    font-weight: var(--fw-regular);
  }
</style>
