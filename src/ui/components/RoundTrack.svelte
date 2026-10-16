<script lang="ts">
  /*
   * Game clock as a strip of rounds: spent rounds are hatched, the current one is lit, and a
   * notch under a round means something scores at its end. Overtime rounds extend the strip.
   */
  interface Props {
    current: number;
    limit: number;
    /** Rounds with an end-of-round scoring check. */
    marks?: readonly number[];
  }

  let { current, limit, marks = [] }: Props = $props();
  const total = $derived(Math.max(limit, current));
</script>

<ol class="track" aria-label="Round {current} of {limit}">
  {#each { length: total }, i (i)}
    {@const r = i + 1}
    <li class="seg" class:past={r < current} class:now={r === current} class:over={r > limit} aria-current={r === current ? 'step' : undefined}>
      <span class="n mono">{r}</span>
      {#if marks.includes(r)}<span class="mark" title="Scoring at end of round {r}"><span class="sr">, scoring</span></span>{/if}
    </li>
  {/each}
</ol>

<style>
  .track {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(2.25rem, 1fr);
    gap: 3px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .seg {
    position: relative;
    display: grid;
    place-items: center;
    height: 2.5rem;
    border: 1px solid var(--c-border-strong);
    background: var(--c-surface-2);
    color: var(--c-text-muted);
    clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%, 7px 50%);
  }
  .seg:first-child {
    clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%);
  }
  .n {
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
  }
  .past {
    background: repeating-linear-gradient(135deg, var(--c-surface-3) 0 4px, var(--c-surface-1) 4px 8px);
    color: var(--c-text-faint);
  }
  .now {
    border-color: var(--c-accent);
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
  .over:not(.now) {
    border-style: dashed;
  }
  .mark {
    position: absolute;
    bottom: 3px;
    left: 50%;
    width: 0.9rem;
    height: 3px;
    transform: translateX(-50%);
    background: var(--c-warn);
  }
  .now .mark {
    background: var(--c-on-accent);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
