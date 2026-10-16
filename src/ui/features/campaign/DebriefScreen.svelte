<script lang="ts">
  import Button from '../../components/Button.svelte';
  import { href } from '../../router.svelte';
  import { missionDef } from '$lib/domain/campaign';
  import Transmission from './Transmission.svelte';
  import { debriefView } from './model/feed';
  import type { CampaignSession } from './session.svelte';

  /* Traffic produced by one command: opening orders, a mission debrief, or new-stage orders. */
  interface Props {
    session: CampaignSession;
    /** First event seq of the command. */
    from: number;
    mission?: string | undefined;
  }
  let { session, from, mission }: Props = $props();

  const campaign = $derived(session.campaign!);
  const cs = $derived(session.open!.state);
  const view = $derived(debriefView(cs.feed, session.open!.save.events, from));
  const traffic = $derived(view.traffic);
  const log = $derived(view.log);
  const kind = $derived(view.kind);
  const def = $derived(mission ? missionDef(campaign, cs, mission) : undefined);
  const outcome = $derived(def && mission ? def.outcomes.find((o) => o.key === cs.missions[mission]?.outcome)?.name : undefined);
  const heading = $derived(kind === 'opening' ? 'Opening orders' : kind === 'stage' ? 'New orders' : `Debrief: ${def?.name ?? 'mission'}`);
</script>

<div class="debrief">
  <header class="hd">
    <h2 class="title">{heading}</h2>
    {#if outcome}<p class="outcome mono">{outcome}</p>{/if}
  </header>

  <section class="traffic" aria-label="Transmissions">
    {#each traffic as e (e.id)}
      <Transmission entry={e} size="lg" />
    {:else}
      <p class="muted">No transmissions.</p>
    {/each}
  </section>

  {#if log.length}
    <details class="log" open={kind === 'debrief'}>
      <summary>Changes logged ({log.length})</summary>
      <ul class="mono" role="list">{#each log as e (e.id)}<li class={e.kind}>{e.text}</li>{/each}</ul>
    </details>
  {/if}

  <div class="acts">
    <Button variant="primary" size="lg" href={href('/campaign', { save: session.id })}>{kind === 'opening' ? 'Go to operations' : 'Return to operations'}</Button>
    <Button size="lg" href={href('/campaign', { save: session.id, view: 'roster' })}>View roster</Button>
  </div>
</div>

<style>
  .debrief {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    max-width: 52rem;
  }
  .title {
    font-size: var(--fs-2xl);
  }
  .outcome {
    margin-top: var(--sp-1);
    color: var(--c-accent);
    font-weight: var(--fw-bold);
  }
  .traffic {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding: var(--sp-5);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-top: 2px solid var(--c-accent);
    border-radius: var(--r-xs);
  }
  .log summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    color: var(--c-accent);
    cursor: pointer;
  }
  .log ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    background: var(--c-surface-1);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .log li::before {
    content: '› ';
  }
  .log li.warning {
    color: var(--c-warn);
  }
  .log li.error {
    color: var(--c-crit);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .muted {
    color: var(--c-text-muted);
  }
</style>
