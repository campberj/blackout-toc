<script lang="ts">
  import type { Campaign } from '$lib/packs/schema';
  import type { FeedEntry } from '$lib/domain/campaign';
  import { FEED_FILTERS, groupFeed, type EventRef, type FeedFilter } from './model/feed';
  import Transmission from './Transmission.svelte';

  /* Message traffic, newest command first. Engine log lines fold under each group. */
  interface Props {
    campaign: Campaign;
    feed: readonly FeedEntry[];
    events: readonly EventRef[];
  }

  let { campaign, feed, events }: Props = $props();
  let filter = $state<FeedFilter>('all');
  let expanded = $state<Record<number, boolean>>({});
  const PAGE = 6;
  let shown = $state(PAGE);
  const all = $derived(groupFeed(feed, events, filter));
  const groups = $derived(all.slice(0, shown));
  const handler = $derived(campaign.personas[0]);
  const time = (at: string | null) => (at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const LOG_FOLD = 3;
</script>

<section class="comms" aria-labelledby="comms-h">
  <header class="net">
    <h2 id="comms-h" class="sr-only">Message traffic</h2>
    {#if handler}
      <p class="handler mono">{handler.callsign ?? handler.name}</p>
      {#if handler.role}<p class="role">{handler.role}</p>{/if}
    {:else}
      <p class="handler mono">Message traffic</p>
    {/if}
    <div class="filters" role="group" aria-label="Show">
      {#each FEED_FILTERS as f (f.id)}
        <button type="button" aria-pressed={filter === f.id} class:on={filter === f.id} onclick={() => (filter = f.id)}>{f.label}</button>
      {/each}
    </div>
  </header>

  <ol class="groups" role="list">
    {#each groups as g (g.cmd)}
      {@const narrative = g.entries.filter((e) => e.kind !== 'system')}
      {@const log = g.entries.filter((e) => e.kind === 'system')}
      {@const open = expanded[g.cmd] || filter === 'log' || log.length <= LOG_FOLD}
      <li class="group">
        <div class="ghead">
          <span class="glabel">{g.label}</span>
          <time class="gtime mono" datetime={g.at ?? undefined}>{time(g.at)}</time>
        </div>
        {#each narrative as e (e.id)}
          {#if e.kind === 'warning' || e.kind === 'error'}
            <p class="alert {e.kind}">{e.text}</p>
          {:else}
            <Transmission entry={e} />
          {/if}
        {/each}
        {#if log.length}
          <ul class="log mono" role="list">
            {#each open ? log : log.slice(0, LOG_FOLD) as e (e.id)}<li>{e.text}</li>{/each}
          </ul>
          {#if log.length > LOG_FOLD && filter !== 'log'}
            <button type="button" class="more" aria-expanded={!!expanded[g.cmd]} onclick={() => (expanded = { ...expanded, [g.cmd]: !expanded[g.cmd] })}>
              {expanded[g.cmd] ? 'Fewer log lines' : `${log.length - LOG_FOLD} more log lines`}
            </button>
          {/if}
        {/if}
      </li>
    {:else}
      <li class="none">Nothing in this view yet.</li>
    {/each}
  </ol>
  {#if all.length > shown}
    <button type="button" class="older" onclick={() => (shown += PAGE)}>Show older traffic ({all.length - shown} more)</button>
  {/if}
</section>

<style>
  .comms {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
  }
  .net {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0 var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-surface-2);
  }
  .handler {
    color: var(--c-accent);
    font-weight: var(--fw-bold);
    letter-spacing: 0.06em;
  }
  .role {
    grid-column: 1;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .filters {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
    margin-top: var(--sp-2);
  }
  .filters button {
    min-height: 2.25rem;
    padding: 0 var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .filters button.on {
    border-color: var(--c-accent);
    color: var(--c-text);
    background: color-mix(in srgb, var(--c-accent) 12%, transparent);
  }
  .filters button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .groups {
    display: flex;
    flex-direction: column;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    border-bottom: 1px solid var(--c-border);
  }
  .group:last-child {
    border-bottom: 0;
  }
  .ghead {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .glabel {
    font-weight: var(--fw-bold);
  }
  .log {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .log li::before {
    content: '› ';
    color: var(--c-text-faint);
  }
  .more {
    align-self: flex-start;
    min-height: 2rem;
    color: var(--c-accent);
    font-size: var(--fs-xs);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  .alert {
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--c-warn);
    font-size: var(--fs-sm);
  }
  .alert.error {
    border-left-color: var(--c-crit);
  }
  .older {
    min-height: var(--touch);
    border-top: 1px solid var(--c-border);
    color: var(--c-accent);
    font-size: var(--fs-sm);
  }
  .none {
    padding: var(--sp-5) var(--sp-4);
    color: var(--c-text-muted);
  }
</style>
