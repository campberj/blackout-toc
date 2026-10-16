<script lang="ts">
  import type { Keyword } from '$lib/packs/schema';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import KeywordPicker from './KeywordPicker.svelte';
  import NumField from './NumField.svelte';
  import RuleList from './RuleList.svelte';
  import WeaponList from './WeaponList.svelte';
  import { blankSpecialist, type SpecialistForm } from './forge-form';

  /* Specialist models: blank stats inherit from the unit. Reuses the weapon/rule editors. */
  interface Props {
    items: SpecialistForm[];
    msg: (path: string) => string | undefined;
    keywords: readonly Keyword[];
  }

  let { items = $bindable(), msg, keywords }: Props = $props();
</script>

<div class="list">
  {#each items as s, i (i)}
    {@const p = `specialists.${i}`}
    <fieldset class="item">
      <legend class="sr-only">Specialist {i + 1}</legend>
      <div class="row">
        <Field label="Specialist name" required error={msg(`${p}.name`) ?? msg(p)}>
          {#snippet control(a)}<input class="control" maxlength="80" {...a} bind:value={items[i]!.name} />{/snippet}
        </Field>
        <IconButton icon="trash" label="Remove specialist {s.name || i + 1}" onclick={() => (items = items.filter((_, j) => j !== i))} />
      </div>
      <p class="hint">Leave a stat blank to use the unit’s value.</p>
      <div class="nums">
        <NumField label="Skill" min={2} max={10} bind:value={items[i]!.skill} error={msg(`${p}.skill`)} />
        <NumField label="Move" min={0} max={24} bind:value={items[i]!.move} error={msg(`${p}.move`)} />
        <NumField label="Armor dice" min={1} max={3} bind:value={items[i]!.armorDice} error={msg(`${p}.armor.dice`) ?? msg(`${p}.armor`)} />
        <NumField label="Armor target" min={2} max={10} bind:value={items[i]!.armorTarget} error={msg(`${p}.armor.target`)} />
      </div>
      <KeywordPicker label="Specialist keywords" appliesTo="model" {keywords} bind:refs={items[i]!.keywords} errorAt={(k) => msg(`${p}.keywords.${k}.key`)} />
      <details>
        <summary>Weapons ({s.weapons.length}) and rules ({s.rules.length})</summary>
        <div class="nested">
          <WeaponList bind:items={items[i]!.weapons} base="{p}.weapons" {msg} {keywords} />
          <RuleList bind:items={items[i]!.rules} base="{p}.rules" {msg} />
        </div>
      </details>
    </fieldset>
  {/each}
  <div>
    <Button disabled={items.length >= 8} onclick={() => (items = [...items, blankSpecialist()])}><Icon name="plus" size={18} />Add specialist</Button>
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
    border-left: 3px solid var(--c-info);
    background: var(--c-surface-2);
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--sp-2);
  }
  .hint {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .nums {
    display: grid;
    gap: var(--sp-2);
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  }
  summary {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    cursor: pointer;
    font-weight: var(--fw-medium);
  }
  .nested {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
</style>
