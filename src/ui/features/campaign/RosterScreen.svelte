<script lang="ts">
  import StatusBadge from '../../components/StatusBadge.svelte';
  import Tag from '../../components/Tag.svelte';
  import Panel from '../../components/Panel.svelte';
  import XpBar from './XpBar.svelte';
  import OperatorDrawer from './OperatorDrawer.svelte';
  import { memorial, teamViews } from './model/roster';
  import type { CampaignSession } from './session.svelte';

  interface Props {
    session: CampaignSession;
  }
  let { session }: Props = $props();
  const campaign = $derived(session.campaign!);
  const cs = $derived(session.open!.state);
  const teams = $derived(teamViews(campaign, cs));
  const fallen = $derived(memorial(campaign, cs, session.open!.save.events));
  let openKey = $state<string | null>(null);
  let drawerOpen = $state(false);

  function show(key: string) {
    openKey = key;
    drawerOpen = true;
  }
</script>

<div class="roster">
  {#each teams as t (t.key)}
    <section class="team" aria-labelledby="rt-{t.key}">
      <header class="thead">
        <div>
          <h2 id="rt-{t.key}" class="tname">{t.name}{#if t.callsign}<span class="mono tcall">{t.callsign}</span>{/if}</h2>
          {#if t.text}<p class="ttext">{t.text}</p>{/if}
        </div>
        <div class="tmeta">
          {#each t.badges as b (b.ladder)}<StatusBadge status={b.tone} label="{b.ladderName}: {b.label}" />{/each}
          <span class="mono small">{t.size}{#if t.maxSize}/{t.maxSize}{/if} operators, tasked {t.stageMissions}× this stage</span>
        </div>
      </header>
      <ul class="ops" role="list">
        {#each t.operators as o (o.key)}
          <li>
            <button type="button" class="op tone-{o.tone}" onclick={() => show(o.key)} aria-haspopup="dialog">
              <span class="id">
                <span class="oname">{o.name}</span>
                {#if o.callsign}<span class="mono call">{o.callsign}</span>{/if}
                <span class="rank">{o.rankName ?? 'Unranked'}</span>
              </span>
              <span class="prog"><XpBar xp={o.xp} /></span>
              <span class="nums mono">
                <span><span class="k">Missions</span> {o.missions}</span>
                <span><span class="k">Kills</span> {o.kills}</span>
                {#each o.stats.filter((st) => st.value !== 0) as st (st.key)}<span><span class="k">{st.name}</span> {st.value}</span>{/each}
              </span>
              <span class="badges">
                {#each o.badges as b (b.ladder)}<StatusBadge status={b.tone} label={b.label} />{/each}
                {#each o.tags as tag (tag)}<Tag>{tag}</Tag>{/each}
              </span>
            </button>
          </li>
        {:else}
          <li class="none">No active operators.</li>
        {/each}
      </ul>
    </section>
  {/each}

  <Panel title="Fallen and removed">
    {#if fallen.length}
      <ul class="memorial" role="list">
        {#each fallen as f (f.key)}
          <li>
            <button type="button" class="mem" onclick={() => show(f.key)} aria-haspopup="dialog">
              <span class="mname">{f.name}{#if f.callsign}<span class="mono call"> {f.callsign}</span>{/if}</span>
              <span class="mreason">{f.reason}{f.stage ? `, ${f.stage}` : ''}</span>
              <span class="mono small">{f.teamName}, {f.missions} mission{f.missions === 1 ? '' : 's'}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">No losses recorded.</p>
    {/if}
  </Panel>
</div>

{#if openKey && cs.operators[openKey]}
  <OperatorDrawer bind:open={drawerOpen} {session} {campaign} operator={cs.operators[openKey]!} />
{/if}

<style>
  .roster {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .team {
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
  }
  .thead {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--sp-2) var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
  }
  .tname {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    font-size: var(--fs-lg);
  }
  .tcall,
  .call {
    color: var(--c-accent);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .ttext {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .tmeta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .small {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .ops li + li {
    border-top: 1px solid var(--c-border);
  }
  .op {
    --tone: transparent;
    display: grid;
    width: 100%;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'id badges' 'prog nums';
    gap: var(--sp-2) var(--sp-4);
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    border-left: 3px solid var(--tone);
    text-align: left;
    color: inherit;
  }
  @media (min-width: 1000px) {
    .op {
      grid-template-columns: minmax(12rem, 1.3fr) minmax(10rem, 1fr) auto minmax(0, 1.2fr);
      grid-template-areas: 'id prog nums badges';
    }
  }
  .op:hover {
    background: var(--c-surface-2);
  }
  .op:focus-visible {
    outline: none;
    box-shadow: inset var(--focus-ring);
  }
  .tone-warn {
    --tone: var(--c-warn);
  }
  .tone-crit {
    --tone: var(--c-crit);
  }
  .id {
    grid-area: id;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-1) var(--sp-2);
    min-width: 0;
  }
  .oname {
    font-weight: var(--fw-bold);
  }
  .rank {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .prog {
    grid-area: prog;
  }
  .nums {
    grid-area: nums;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1) var(--sp-3);
    font-size: var(--fs-sm);
  }
  .k {
    color: var(--c-text-muted);
    font-family: var(--font-sans);
    font-size: var(--fs-xs);
  }
  .badges {
    grid-area: badges;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--sp-1);
  }
  .none,
  .muted {
    padding: var(--sp-3) var(--sp-4);
    color: var(--c-text-muted);
  }
  .muted {
    padding: 0;
  }
  .memorial {
    display: flex;
    flex-direction: column;
  }
  .memorial li + li {
    border-top: 1px solid var(--c-border);
  }
  .mem {
    display: grid;
    width: 100%;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px var(--sp-4);
    padding: var(--sp-2) 0;
    text-align: left;
    color: inherit;
    min-height: var(--touch);
  }
  .mem:hover .mname {
    text-decoration: underline;
  }
  .mname {
    font-weight: var(--fw-bold);
  }
  .mreason {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    text-align: right;
  }
</style>
