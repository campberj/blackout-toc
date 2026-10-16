<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import NumField from './NumField.svelte';
  import { blankRule, type RuleForm } from './forge-form';

  interface Props {
    items: RuleForm[];
    base: string;
    msg: (path: string) => string | undefined;
  }

  let { items = $bindable(), base, msg }: Props = $props();
</script>

<div class="list">
  {#each items as r, i (i)}
    {@const p = `${base}.${i}`}
    <fieldset class="item">
      <legend class="sr-only">Rule {i + 1}</legend>
      <div class="row">
        <Field label="Rule name" required error={msg(`${p}.name`) ?? msg(p)}>
          {#snippet control(a)}<input class="control" maxlength="80" {...a} bind:value={items[i]!.name} />{/snippet}
        </Field>
        <NumField label="Uses" min={1} max={9} hint="Boxes on card" bind:value={items[i]!.usesMax} error={msg(`${p}.usesMax`)} />
        <IconButton icon="trash" label="Remove rule {r.name || i + 1}" onclick={() => (items = items.filter((_, j) => j !== i))} />
      </div>
      <Field label="Rule text" error={msg(`${p}.text`)}>
        {#snippet control(a)}<textarea class="control" rows="2" {...a} bind:value={items[i]!.text}></textarea>{/snippet}
      </Field>
    </fieldset>
  {/each}
  <div>
    <Button onclick={() => (items = [...items, blankRule()])}><Icon name="plus" size={18} />Add rule</Button>
  </div>
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    margin: 0;
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-border-strong);
    background: var(--c-surface-2);
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 7rem auto;
    align-items: start;
    gap: var(--sp-2);
  }
  .row > :global(.icon-btn) {
    margin-top: 1.6rem;
  }
</style>
