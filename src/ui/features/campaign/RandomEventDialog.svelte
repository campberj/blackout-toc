<script lang="ts">
  import type { FeedEntry } from '$lib/domain/campaign';
  import Dialog from '../../components/Dialog.svelte';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Transmission from './Transmission.svelte';
  import type { TableOption } from './model/tables';
  import type { CampaignSession } from './session.svelte';

  /* Roll one of the campaign's tables (seeded by the engine) and show what came up. */
  interface Props {
    open: boolean;
    session: CampaignSession;
    tables: readonly TableOption[];
  }
  let { open = $bindable(), session, tables }: Props = $props();
  let table = $state('');
  let result = $state<FeedEntry[] | null>(null);
  let error = $state<string | null>(null);
  const chosen = $derived(tables.find((t) => t.id === table));

  $effect(() => {
    if (open) {
      result = null;
      error = null;
      if (!tables.some((t) => t.id === table)) table = tables[0]?.id ?? '';
    }
  });

  async function roll() {
    error = null;
    const r = await session.run({ type: 'rollRandomEvent', table });
    if (!r.ok) {
      error = r.error;
      return;
    }
    const seqs = new Set(r.value.map((e) => e.seq));
    result = session.state?.feed.filter((f) => seqs.has(f.seq)) ?? [];
  }
</script>

<Dialog bind:open title="Roll random event">
  <div class="stack">
    {#if tables.length === 0}
      <p>This campaign has no random tables.</p>
    {:else}
      <Field label="Table" {...chosen ? { hint: `${chosen.entries} entries${chosen.text ? `. ${chosen.text}` : ''}` } : {}}>
        {#snippet control(a)}
          <select class="control" {...a} bind:value={table} onchange={() => (result = null)}>
            {#each tables as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
          </select>
        {/snippet}
      </Field>
    {/if}
    {#if result}
      <div class="result" aria-live="polite">
        {#each result as e (e.id)}
          {#if e.kind === 'system'}<p class="log mono">› {e.text}</p>{:else}<Transmission entry={e} />{/if}
        {:else}
          <p class="log">Nothing of note.</p>
        {/each}
      </div>
    {/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (open = false)}>{result ? 'Done' : 'Cancel'}</Button>
    <Button variant="primary" disabled={!table || session.busy} onclick={roll}>{result ? 'Roll again' : 'Roll'}</Button>
  {/snippet}
</Dialog>

<style>
  .result {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    background: var(--c-surface-2);
  }
  .log {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .err {
    color: var(--c-crit);
  }
</style>
