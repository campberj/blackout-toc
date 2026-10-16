<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import NumField from './NumField.svelte';
  import { blankTrack, type TrackForm } from './forge-form';

  /* Damage tracks (handler wounds, duster chassis/mobility). None = destroyed on first damage. */
  interface Props {
    items: TrackForm[];
    msg: (path: string) => string | undefined;
  }

  let { items = $bindable(), msg }: Props = $props();
</script>

<div class="list">
  {#if items.length === 0}<p class="none">No damage tracks: the unit is removed on its first damage.</p>{/if}
  {#each items as t, i (i)}
    <div class="row">
      <Field label="Track name" required error={msg(`damageTracks.${i}.name`) ?? msg(`damageTracks.${i}`)}>
        {#snippet control(a)}<input class="control" maxlength="80" placeholder="Wounds" {...a} bind:value={items[i]!.name} />{/snippet}
      </Field>
      <NumField label="Boxes" min={1} max={12} required bind:value={items[i]!.size} error={msg(`damageTracks.${i}.size`)} />
      <IconButton icon="trash" label="Remove track {t.name || i + 1}" onclick={() => (items = items.filter((_, j) => j !== i))} />
    </div>
  {/each}
  <div>
    <Button disabled={items.length >= 4} onclick={() => (items = [...items, blankTrack()])}><Icon name="plus" size={18} />Add damage track</Button>
  </div>
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 7rem auto;
    align-items: end;
    gap: var(--sp-2);
  }
  .none {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
