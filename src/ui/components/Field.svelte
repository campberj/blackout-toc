<script lang="ts" module>
  export interface FieldControlAttrs {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': 'true' | undefined;
    required: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /*
   * Label + hint + error around any control. The control snippet receives the
   * ids to wire up, so Field stays agnostic of input/select/textarea:
   *   <Field label="Name">{#snippet control(a)}<input class="control" {...a} />{/snippet}</Field>
   */

  interface Props {
    label: string;
    hint?: string;
    error?: string | undefined;
    required?: boolean;
    control: Snippet<[FieldControlAttrs]>;
  }

  let { label, hint, error, required = false, control }: Props = $props();

  const uid = $props.id();
  const id = `f-${uid}`;
  const describedBy = $derived([hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined);
  const attrs = $derived<FieldControlAttrs>({
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : undefined,
    required,
  });
</script>

<div class="field">
  <label for={id} class="label">
    {label}{#if required}<span class="req" aria-hidden="true"> *</span>{/if}
  </label>
  {@render control(attrs)}
  {#if hint}
    <p id="{id}-h" class="hint">{hint}</p>
  {/if}
  {#if error}
    <p id="{id}-e" class="error">{error}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    min-width: 0;
  }
  .label {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .req {
    color: var(--c-crit);
  }
  .hint {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .error {
    color: var(--c-crit);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
</style>
