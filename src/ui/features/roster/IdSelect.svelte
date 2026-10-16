<script lang="ts">
  import Field from '../../components/Field.svelte';

  /* Field + <select> over faction-grouped options. Empty value = none. */
  interface Props {
    label: string;
    value: string | undefined;
    groups: readonly { label: string; items: readonly { id: string; name: string }[] }[];
    /** Text of the empty option. */
    none: string;
    hint?: string;
    error?: string | undefined;
    required?: boolean;
    onchange: (id: string) => void;
  }

  let { label, value, groups, none, hint, error, required = false, onchange }: Props = $props();
</script>

<Field {label} {...hint ? { hint } : {}} {error} {required}>
  {#snippet control(a)}
    <select class="control" {...a} value={value ?? ''} onchange={(e) => onchange(e.currentTarget.value)}>
      <option value="">{none}</option>
      {#each groups as g (g.label)}
        <optgroup label={g.label}>
          {#each g.items as it (it.id)}<option value={it.id}>{it.name}</option>{/each}
        </optgroup>
      {/each}
    </select>
  {/snippet}
</Field>
