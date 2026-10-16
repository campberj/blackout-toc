<script lang="ts">
  import IconButton from './IconButton.svelte';

  /*
   * − value + with no local state (unlike Counter): the caller applies `onstep(±1)` and passes
   * the new value back, so refused changes never leave a stale number on screen.
   */
  interface Props {
    label: string;
    value: number | string;
    /** Disable the − button (e.g. at 0). */
    atMin?: boolean;
    atMax?: boolean;
    size?: 'md' | 'lg';
    onstep: (delta: 1 | -1) => void;
  }

  let { label, value, atMin = false, atMax = false, size = 'md', onstep }: Props = $props();
</script>

<div class="stepper {size}" role="group" aria-label={label}>
  <IconButton icon="minus" variant="secondary" label="Decrease {label}" disabled={atMin} onclick={() => onstep(-1)} />
  <output class="value mono" aria-live="polite">{value}</output>
  <IconButton icon="plus" variant="secondary" label="Increase {label}" disabled={atMax} onclick={() => onstep(1)} />
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
  }
  .value {
    min-width: 2.5ch;
    text-align: center;
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    line-height: 1;
  }
  .lg .value {
    min-width: 3ch;
    font-size: var(--fs-2xl);
  }
</style>
