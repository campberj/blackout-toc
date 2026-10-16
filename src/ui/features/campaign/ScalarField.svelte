<script lang="ts">
  import type { FieldDef, Scalar } from '$lib/packs/schema';
  import Field from '../../components/Field.svelte';
  import { parseNumber } from './model/aar';

  /* Pack FieldDef → control by kind. Value is loose (undefined = unset) so blanks fall back to pack defaults. */
  interface Props {
    def: Pick<FieldDef, 'key' | 'label' | 'kind' | 'options' | 'min' | 'max' | 'help'>;
    value: Scalar | undefined;
    onchange: (v: Scalar | undefined) => void;
    /** Overrides the field label (e.g. shorter in dense rows). */
    label?: string | undefined;
    /** Extra hint appended after the pack help. */
    hint?: string | undefined;
    hideHelp?: boolean;
    disabled?: boolean;
  }

  let { def, value, onchange, label, hint, hideHelp = false, disabled = false }: Props = $props();
  const help = $derived([hideHelp ? '' : (def.help ?? ''), hint ?? ''].filter(Boolean).join(' ') || undefined);
</script>

{#if def.kind === 'boolean'}
  <label class="check">
    <input type="checkbox" checked={value === true} {disabled} onchange={(e) => onchange(e.currentTarget.checked)} />
    <span class="lbl">{label ?? def.label}</span>
    {#if help}<span class="help">{help}</span>{/if}
  </label>
{:else}
  <Field label={label ?? def.label} {...help ? { hint: help } : {}}>
    {#snippet control(a)}
      {#if def.kind === 'number'}
        <input
          class="control mono"
          type="number"
          inputmode="numeric"
          min={def.min}
          max={def.max}
          {disabled}
          {...a}
          value={typeof value === 'number' ? value : ''}
          oninput={(e) => onchange(parseNumber(e.currentTarget.value))}
        />
      {:else if def.kind === 'choice'}
        <select class="control" {disabled} {...a} value={typeof value === 'string' ? value : ''} onchange={(e) => onchange(e.currentTarget.value || undefined)}>
          {#if value === undefined}<option value="">Choose…</option>{/if}
          {#each def.options ?? [] as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
        </select>
      {:else}
        <textarea class="control text" rows="1" {disabled} {...a} value={typeof value === 'string' ? value : ''} oninput={(e) => onchange(e.currentTarget.value)}></textarea>
      {/if}
    {/snippet}
  </Field>
{/if}

<style>
  /* Pack text fields have no length hint: grow with content (one line when short). */
  textarea.text {
    min-height: var(--touch);
    field-sizing: content;
    resize: none;
  }
  .check {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: var(--sp-2);
    min-height: var(--touch);
    cursor: pointer;
  }
  .check input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--c-accent);
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .help {
    grid-column: 2;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
