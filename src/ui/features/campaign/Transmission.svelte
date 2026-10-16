<script lang="ts">
  import type { FeedEntry } from '$lib/domain/campaign';

  /*
   * One handler transmission: callsign header + monospace message body, the way traffic
   * reads on a net. Unattributed narrative (campaign intro) shows its title only.
   */
  interface Props {
    entry: Pick<FeedEntry, 'kind' | 'title' | 'text' | 'speaker' | 'seq'>;
    /** Larger body type for full-screen briefings/debriefs. */
    size?: 'md' | 'lg';
  }

  let { entry, size = 'md' }: Props = $props();
  const who = $derived(entry.speaker ? (entry.speaker.callsign ?? entry.speaker.name) : null);
</script>

{#if entry.kind === 'filtered'}
  <p class="withheld">{entry.text}</p>
{:else}
  <article class="tx {size}" class:unattributed={!who}>
    <header class="hd">
      {#if who}<span class="who mono">{who}</span>{/if}
      {#if entry.title}<span class="title">{entry.title}</span>{/if}
    </header>
    <div class="body mono">{entry.text}</div>
  </article>
{/if}

<style>
  .tx {
    border-left: 2px solid var(--c-accent);
    padding: var(--sp-1) 0 var(--sp-1) var(--sp-3);
  }
  .tx.unattributed {
    border-left-color: var(--c-border-strong);
  }
  .hd {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-1) var(--sp-3);
    margin-bottom: var(--sp-2);
  }
  .who {
    color: var(--c-accent);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    letter-spacing: 0.04em;
  }
  .title {
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .body {
    max-width: 72ch;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--c-text);
  }
  .lg .body {
    font-size: var(--fs-md);
    line-height: 1.65;
  }
  .lg .title {
    font-size: var(--fs-md);
  }
  .withheld {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-style: italic;
  }
</style>
