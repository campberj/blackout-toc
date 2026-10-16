<script lang="ts">
  import Field from '../../components/Field.svelte';
  import type { Num } from './forge-form';

  /* Small numeric Field; empty = absent (optional stats inherit / have no value). */
  interface Props {
    label: string;
    value: Num;
    min?: number;
    max?: number;
    hint?: string;
    error?: string | undefined;
    required?: boolean;
  }

  let { label, value = $bindable(), min, max, hint, error, required = false }: Props = $props();
</script>

<div class="num">
  <Field {label} {...hint ? { hint } : {}} {error} {required}>
    {#snippet control(a)}
      <input class="control mono" type="number" inputmode="numeric" step="1" {min} {max} {...a} bind:value />
    {/snippet}
  </Field>
</div>

<style>
  .num {
    min-width: 0;
  }
  input {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
</style>
