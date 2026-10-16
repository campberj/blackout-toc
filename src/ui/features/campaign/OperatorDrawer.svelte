<script lang="ts">
  import type { Campaign, Scalar } from '$lib/packs/schema';
  import type { OperatorState } from '$lib/domain/campaign';
  import Drawer from '../../components/Drawer.svelte';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import Tag from '../../components/Tag.svelte';
  import { toasts } from '../../components/toast.svelte';
  import ScalarField from './ScalarField.svelte';
  import XpBar from './XpBar.svelte';
  import { historyGroups, operatorRow } from './model/roster';
  import { operatorEdit, type OperatorEditDraft } from './model/operator-edit';
  import type { CampaignSession } from './session.svelte';

  interface Props {
    open: boolean;
    session: CampaignSession;
    campaign: Campaign;
    operator: OperatorState;
  }
  let { open = $bindable(), session, campaign, operator }: Props = $props();
  const row = $derived(operatorRow(campaign, session.open!.state, operator));
  const groups = $derived(historyGroups(operator));
  let edit = $state<OperatorEditDraft>({ name: '', callsign: '', fields: {} });
  let error = $state<string | null>(null);

  // Reset the form whenever a (different) operator opens.
  $effect(() => {
    if (open) {
      edit = { name: operator.name, callsign: operator.callsign ?? '', fields: { ...operator.fields } };
      error = null;
    }
  });

  const cmd = $derived(operatorEdit(operator, edit));

  async function save() {
    if (!cmd.command) return;
    if (cmd.problem) {
      error = cmd.problem;
      return;
    }
    const r = await session.run(cmd.command);
    if (!r.ok) {
      error = r.error;
      return;
    }
    error = null;
    toasts.push(`Record updated: ${edit.name.trim()}.`, 'ok');
  }

  const setField = (k: string, v: Scalar | undefined) => {
    const next = { ...edit.fields };
    if (v === undefined) delete next[k];
    else next[k] = v;
    edit.fields = next;
  };
</script>

<Drawer bind:open title={operator.name} subtitle={[operator.callsign, row.teamName, row.rankName].filter(Boolean).join(', ')}>
  <div class="stack">
    {#if row.removal}
      <p class="removed"><StatusBadge status="crit" label={row.removal.label} /></p>
    {/if}
    <section>
      <h3 class="h">Status</h3>
      <div class="cluster">
        {#each row.allLadders as b (b.ladder)}<StatusBadge status={b.tone} label="{b.ladderName}: {b.label}" />{/each}
        {#each row.tags as t (t)}<Tag>{t}</Tag>{/each}
      </div>
    </section>
    <section>
      <h3 class="h">Service</h3>
      <XpBar xp={row.xp} />
      <dl class="stats">
        <div><dt>Missions</dt><dd class="mono">{row.missions}</dd></div>
        <div><dt>Kills</dt><dd class="mono">{row.kills}</dd></div>
        {#each row.stats as st (st.key)}<div><dt>{st.name}</dt><dd class="mono">{st.value}</dd></div>{/each}
      </dl>
    </section>

    <form class="edit" onsubmit={(e) => { e.preventDefault(); void save(); }}>
      <h3 class="h">Record</h3>
      <div class="grid">
        <Field label="Name" required>
          {#snippet control(a)}<input class="control" {...a} bind:value={edit.name} maxlength="80" />{/snippet}
        </Field>
        <Field label="Callsign">
          {#snippet control(a)}<input class="control mono" {...a} bind:value={edit.callsign} maxlength="80" />{/snippet}
        </Field>
      </div>
      {#each campaign.roster.operatorFields as f (f.key)}
        <ScalarField def={f} value={edit.fields[f.key]} onchange={(v) => setField(f.key, v)} />
      {/each}
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <div><Button variant="primary" type="submit" disabled={!cmd.command || session.busy}>Save record</Button></div>
    </form>

    {#each groups as g (g.id)}
      {#if g.entries.length}
        <section>
          <h3 class="h">{g.label}</h3>
          <ol class="hist" role="list">{#each g.entries as h, i (`${h.seq}-${i}`)}<li><span class="mono seq">#{h.seq}</span>{h.text}</li>{/each}</ol>
        </section>
      {/if}
    {/each}
  </div>
</Drawer>

<style>
  .h {
    margin-bottom: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-5);
    margin-top: var(--sp-3);
  }
  .stats dt {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .stats dd {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .edit {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding-top: var(--sp-4);
    border-top: 1px solid var(--c-border);
  }
  .grid {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  }
  .hist {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    font-size: var(--fs-sm);
  }
  .hist li {
    display: grid;
    grid-template-columns: 3rem 1fr;
    gap: var(--sp-2);
  }
  .seq {
    color: var(--c-text-faint);
    font-size: var(--fs-xs);
  }
  .err {
    color: var(--c-crit);
    font-size: var(--fs-sm);
  }
</style>
