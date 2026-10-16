<script lang="ts">
  import type { Keyword } from '$lib/packs/schema';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import KeywordPicker from './KeywordPicker.svelte';
  import NumField from './NumField.svelte';
  import { blankWeapon, type WeaponForm } from './forge-form';

  interface Props {
    items: WeaponForm[];
    /** Issue path prefix, e.g. `weapons` or `specialists.0.weapons`. */
    base: string;
    msg: (path: string) => string | undefined;
    keywords: readonly Keyword[];
  }

  let { items = $bindable(), base, msg, keywords }: Props = $props();
</script>

<div class="list">
  {#each items as w, i (i)}
    {@const p = `${base}.${i}`}
    <fieldset class="item">
      <legend class="sr-only">Weapon {i + 1}</legend>
      <div class="row">
        <Field label="Weapon name" required error={msg(`${p}.name`) ?? msg(p)}>
          {#snippet control(a)}<input class="control" maxlength="80" {...a} bind:value={items[i]!.name} />{/snippet}
        </Field>
        <IconButton icon="trash" label="Remove weapon {w.name || i + 1}" onclick={() => (items = items.filter((_, j) => j !== i))} />
      </div>
      <div class="nums">
        <NumField label="Min range" min={0} max={96} bind:value={items[i]!.minRange} error={msg(`${p}.minRange`)} />
        <NumField label="Max range" min={1} max={96} bind:value={items[i]!.maxRange} error={msg(`${p}.maxRange`)} />
        <NumField label="Damage" min={0} max={10} bind:value={items[i]!.damage} error={msg(`${p}.damage`)} />
        <NumField label="Uses" min={1} max={9} hint="Blank = unlimited" bind:value={items[i]!.usesMax} error={msg(`${p}.usesMax`)} />
      </div>
      <KeywordPicker label="Weapon keywords" appliesTo="weapon" {keywords} bind:refs={items[i]!.keywords} errorAt={(k) => msg(`${p}.keywords.${k}.key`)} />
      <Field label="Text" hint="For ability-style weapons without a profile" error={msg(`${p}.text`)}>
        {#snippet control(a)}<input class="control" {...a} bind:value={items[i]!.text} />{/snippet}
      </Field>
    </fieldset>
  {/each}
  <div>
    <Button onclick={() => (items = [...items, blankWeapon()])}><Icon name="plus" size={18} />Add weapon</Button>
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
    gap: var(--sp-3);
    margin: 0;
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-border-strong);
    background: var(--c-surface-2);
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--sp-2);
  }
  .nums {
    display: grid;
    gap: var(--sp-2);
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  }
</style>
