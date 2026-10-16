<script lang="ts">
  import type { Side } from '$lib/app';
  import type { UnitCard } from '$lib/packs/schema';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import Field from '../../components/Field.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import type { BoardController } from './board.svelte';

  /* Add to a side: copies of a loaded unit card, or a generic contact (name, models, damage track). */
  interface Props {
    board: BoardController;
    side: Side;
    units: readonly UnitCard[];
    open: boolean;
  }

  let { board, side, units, open = $bindable() }: Props = $props();

  type Mode = 'card' | 'contact';
  let mode = $state<Mode>('card');
  const modes = [
    { value: 'card' as const, label: 'Unit card' },
    { value: 'contact' as const, label: 'Custom contact' },
  ];

  // Hostiles first: they are the usual OPFOR quick-adds.
  const sorted = $derived([...units].sort((a, b) => Number(b.type === 'hostile') - Number(a.type === 'hostile') || a.name.localeCompare(b.name)));
  let unitId = $state('');
  let count = $state(1);
  let name = $state('');
  let models = $state(1);
  let trackName = $state('');
  let trackSize = $state(0);

  $effect(() => {
    if (!unitId && sorted[0]) unitId = sorted[0].id;
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const done =
      mode === 'card'
        ? await board.quickAdd(side, unitId, count)
        : await board.addContact(side, {
            name: name.trim(),
            models,
            ...(trackSize > 0 ? { track: { name: trackName.trim() || 'Damage', size: trackSize } } : {}),
          });
    if (done) {
      open = false;
      name = '';
    }
  }
</script>

<Dialog bind:open title={side === 'opfor' ? 'Add OPFOR' : 'Add to your force'}>
  <form id="add-unit" class="form" onsubmit={submit}>
    <Segmented label="Source" options={modes} value={mode} onchange={(m) => (mode = m)} />
    {#if mode === 'card'}
      {#if sorted.length === 0}
        <p class="muted">No unit cards are loaded. Import a pack in the Library, or add a custom contact.</p>
      {:else}
        <Field label="Unit card">
          {#snippet control(a)}
            <select class="control" {...a} bind:value={unitId}>
              {#each sorted as u (u.id)}<option value={u.id}>{u.name}{u.type === 'hostile' ? ' (hostile)' : ''}</option>{/each}
            </select>
          {/snippet}
        </Field>
        <Field label="How many units">
          {#snippet control(a)}<input class="control" type="number" min="1" max="20" {...a} bind:value={count} />{/snippet}
        </Field>
      {/if}
    {:else}
      <Field label="Name" required>
        {#snippet control(a)}<input class="control" {...a} bind:value={name} maxlength="80" placeholder="e.g. Militia squad" />{/snippet}
      </Field>
      <Field label="Models">
        {#snippet control(a)}<input class="control" type="number" min="1" max="20" {...a} bind:value={models} />{/snippet}
      </Field>
      <div class="pair">
        <Field label="Damage track" hint="Leave size at 0 if one hit removes a model.">
          {#snippet control(a)}<input class="control" {...a} bind:value={trackName} maxlength="80" placeholder="Wounds" />{/snippet}
        </Field>
        <Field label="Boxes">
          {#snippet control(a)}<input class="control" type="number" min="0" max="12" {...a} bind:value={trackSize} />{/snippet}
        </Field>
      </div>
    {/if}
  </form>
  {#snippet actions()}
    <Button onclick={() => (open = false)}>Cancel</Button>
    <Button type="submit" form="add-unit" variant="primary" disabled={mode === 'card' ? !unitId : !name.trim()}>Add</Button>
  {/snippet}
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 6rem;
    gap: var(--sp-2);
    align-items: start;
  }
  .muted {
    color: var(--c-text-muted);
  }
</style>
