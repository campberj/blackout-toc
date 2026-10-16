<script lang="ts">
  import type { Campaign } from '$lib/packs/schema';
  import type { CampaignState } from '$lib/domain/campaign';
  import Button from '../../components/Button.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import { effectOps, newRow, normalizeRow, refOptions, rowProblems, targetOptions, valueOptions, type EditorContext, type EffectRow, type RowOp } from './model/effects';

  /* Flat effect rows (rewards / GM adjustments). Dependent selects re-normalize on change. */
  interface Props {
    campaign: Campaign;
    cs: CampaignState;
    context: EditorContext;
    rows: EffectRow[];
    addLabel?: string;
  }
  let { campaign, cs, context, rows = $bindable(), addLabel = 'Add effect' }: Props = $props();
  const ops = $derived(effectOps(campaign, context));
  const uid = $props.id();

  function update(i: number, patch: Partial<EffectRow>) {
    rows = rows.map((r, j) => (j === i ? normalizeRow(campaign, cs, { ...r, ...patch }, context) : r));
  }
  const needsTarget = (op: RowOp) => ['addXp', 'adjustStat', 'setLadder', 'promote', 'removeOperator'].includes(op);
  const needsAmount = (op: RowOp) => ['adjustTrack', 'adjustPool', 'grantAsset', 'addXp', 'adjustStat'].includes(op);
</script>

<div class="rows">
  {#each rows as row, i (i)}
    {@const refs = refOptions(campaign, row.op)}
    {@const targets = targetOptions(campaign, cs, context, row)}
    {@const values = valueOptions(campaign, row)}
    {@const problem = rowProblems(row)}
    <fieldset class="row">
      <legend class="sr-only">Effect {i + 1}</legend>
      <label class="cell">
        <span class="lbl">Effect</span>
        <select class="control" value={row.op} onchange={(e) => update(i, { op: e.currentTarget.value as RowOp })}>
          {#each ops as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
        </select>
      </label>
      {#if refs.length}
        <label class="cell">
          <span class="lbl">What</span>
          <select class="control" value={row.ref} onchange={(e) => update(i, { ref: e.currentTarget.value })}>
            {#each refs as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
          </select>
        </label>
      {:else if row.op === 'setFlag'}
        <label class="cell">
          <span class="lbl">Flag key</span>
          <input class="control mono" value={row.ref} aria-invalid={problem ? 'true' : undefined} aria-describedby={problem ? `${uid}-p${i}` : undefined} oninput={(e) => update(i, { ref: e.currentTarget.value })} />
        </label>
      {/if}
      {#if needsTarget(row.op) && targets.length}
        <label class="cell wide">
          <span class="lbl">Who</span>
          <select class="control" value={row.target} onchange={(e) => update(i, { target: e.currentTarget.value })}>
            {#each targets as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
          </select>
        </label>
      {/if}
      {#if needsAmount(row.op)}
        <label class="cell narrow">
          <span class="lbl">{row.op === 'grantAsset' ? 'Count' : 'Amount'}</span>
          <input class="control mono" type="number" inputmode="numeric" value={row.amount} oninput={(e) => update(i, { amount: Number(e.currentTarget.value) })} />
        </label>
      {/if}
      {#if values.length}
        <label class="cell">
          <span class="lbl">{row.op === 'removeOperator' ? 'Reason' : 'State'}</span>
          <select class="control" value={row.value} onchange={(e) => update(i, { value: e.currentTarget.value })}>
            {#each values as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
          </select>
        </label>
      {:else if row.op === 'setFlag'}
        <label class="cell narrow">
          <span class="lbl">Value</span>
          <input class="control mono" value={row.value} oninput={(e) => update(i, { value: e.currentTarget.value })} />
        </label>
      {/if}
      <div class="rm"><IconButton icon="trash" label="Remove effect {i + 1}" onclick={() => (rows = rows.filter((_, j) => j !== i))} /></div>
      {#if problem}<p id="{uid}-p{i}" class="problem">{problem}</p>{/if}
    </fieldset>
  {/each}
  {#if ops.length}
    <div><Button onclick={() => (rows = [...rows, newRow(campaign, cs, ops[0]!.value as RowOp, context)])}>{addLabel}</Button></div>
  {/if}
</div>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    background: var(--c-surface-2);
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 9rem;
    min-width: 0;
  }
  .cell.wide {
    flex-basis: 12rem;
  }
  .cell.narrow {
    flex: 0 1 6rem;
  }
  .lbl {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
  }
  .rm {
    margin-left: auto;
  }
  .problem {
    flex-basis: 100%;
    color: var(--c-crit);
    font-size: var(--fs-sm);
  }
</style>
