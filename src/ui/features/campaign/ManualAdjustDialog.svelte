<script lang="ts">
  import type { Campaign } from '$lib/packs/schema';
  import type { CampaignState } from '$lib/domain/campaign';
  import Dialog from '../../components/Dialog.svelte';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import EffectRowsEditor from './EffectRowsEditor.svelte';
  import { describeRow, rowProblems, rowToEffect, type EffectRow } from './model/effects';
  import type { CampaignSession } from './session.svelte';
  import { toasts } from '../../components/toast.svelte';

  /* GM override: any listed effect, logged with a note (undoable like every command). */
  interface Props {
    open: boolean;
    session: CampaignSession;
    campaign: Campaign;
    cs: CampaignState;
  }
  let { open = $bindable(), session, campaign, cs }: Props = $props();
  let rows = $state<EffectRow[]>([]);
  let note = $state('');
  let tried = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (open) {
      rows = [];
      note = '';
      tried = false;
      error = null;
    }
  });

  const problems = $derived([
    ...(note.trim() ? [] : ['Add a note saying why (it goes in the log).']),
    ...(rows.length ? [] : ['Add at least one effect.']),
    ...rows.flatMap((r) => rowProblems(r) ?? []),
  ]);

  async function apply() {
    tried = true;
    if (problems.length) return;
    const r = await session.run({ type: 'applyManualAdjustment', note: note.trim(), effects: rows.map(rowToEffect) });
    if (!r.ok) {
      error = r.error;
      return;
    }
    open = false;
    toasts.push('Adjustment applied and logged.', 'ok');
  }
</script>

<Dialog bind:open title="GM adjustment">
  <form id="gm-form" class="stack" onsubmit={(e) => { e.preventDefault(); void apply(); }}>
    <p class="note">Fix a missed result or apply a house ruling. The change and your note are written to the campaign log.</p>
    <EffectRowsEditor {campaign} {cs} context="manual" bind:rows />
    <Field label="Note" required error={tried && !note.trim() ? 'Add a note.' : undefined}>
      {#snippet control(a)}<input class="control" {...a} bind:value={note} maxlength="280" placeholder="e.g. Forgot Voss's kill in TRIPWIRE" />{/snippet}
    </Field>
    {#if rows.length}
      <div class="sum">
        <p class="lbl">Will apply</p>
        <ul class="mono">{#each rows as r, i (i)}<li>{describeRow(campaign, cs, r, 'manual')}</li>{/each}</ul>
      </div>
    {/if}
    {#if tried && problems.length}<ul class="problems" role="alert">{#each problems as p (p)}<li>{p}</li>{/each}</ul>{/if}
    {#if error}<p class="problems" role="alert">{error}</p>{/if}
  </form>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" type="submit" form="gm-form" disabled={session.busy}>Apply adjustment</Button>
  {/snippet}
</Dialog>

<style>
  .note,
  .lbl {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .sum ul {
    font-size: var(--fs-sm);
  }
  .problems {
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--c-crit);
    font-size: var(--fs-sm);
  }
</style>
