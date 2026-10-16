<script lang="ts">
  import type { RosterPrintModel } from '../../../app';
  import CardView from '../../components/card/CardView.svelte';
  import ForceCardView from '../../components/card/ForceCardView.svelte';

  /* Paper output: roster sheet, then the 2-up card grid (print.css). Hidden on screen. */
  interface Props {
    model: RosterPrintModel;
  }

  let { model }: Props = $props();
</script>

<div class="print-only">
  <section class="print-roster-sheet sheet">
    <header class="sh">
      <h1>{model.name}</h1>
      <p>{model.mode} roster, {model.ruleset}</p>
    </header>
    <table>
      <thead><tr><th scope="col">Group</th><th scope="col">Force card</th><th scope="col">Handler</th><th scope="col">Units</th></tr></thead>
      <tbody>
        {#each model.groups as g, i (i)}
          <tr>
            <td>{i + 1}</td>
            <td>{g.force?.name ?? '—'}</td>
            <td>{g.handler?.name ?? '—'}</td>
            <td>{g.units.map((u) => u.name).join(', ') || '—'}</td>
          </tr>
        {/each}
        {#if model.duster}<tr><td>Duster</td><td colspan="3">{model.duster.name}</td></tr>{/if}
      </tbody>
    </table>
    {#if model.notes}<p class="notes"><strong>Notes:</strong> {model.notes}</p>{/if}
    {#if model.missing.length > 0}<p class="warn">Not loaded: {model.missing.join(', ')}</p>{/if}
    {#if model.issues.length > 0}
      <ul class="warn">{#each model.issues as it, i (i)}<li>{it.message}</li>{/each}</ul>
    {/if}
  </section>

  <div class="print-card-grid cards">
    {#each model.groups as g, i (i)}
      {#if g.force}<ForceCardView card={g.force} variant="print" />{/if}
      {#if g.handler}<CardView card={g.handler} variant="print" />{/if}
      {#each g.units as u, j (j)}<CardView card={u} variant="print" />{/each}
    {/each}
    {#if model.duster}<CardView card={model.duster} variant="print" />{/if}
  </div>
</div>

<style>
  .sheet {
    margin-bottom: 6mm;
  }
  .sh {
    padding-bottom: 2mm;
    margin-bottom: 3mm;
    border-bottom: 2px solid #000;
  }
  .sh h1 {
    font-size: 18pt;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 1.5mm 2mm;
    border: 1px solid #555;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #eee;
  }
  .notes,
  .warn {
    margin-top: 3mm;
    max-width: none;
  }
  .warn {
    font-style: italic;
  }
  .cards {
    break-before: page;
  }
</style>
