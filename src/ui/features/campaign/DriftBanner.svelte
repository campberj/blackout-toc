<script lang="ts">
  import type { PackDrift } from '../../../app';
  import Icon from '../../components/Icon.svelte';

  /* Save recorded different pack versions than are loaded now: replay may diverge. Warning only. */
  interface Props {
    drift: readonly PackDrift[];
  }
  let { drift }: Props = $props();
</script>

<div class="drift" role="status">
  <Icon name="alert" size={18} />
  <div>
    <p class="head">Pack versions changed since this campaign started</p>
    <ul role="list">
      {#each drift as d (d.packId)}
        <li class="mono">{d.packId}: started on {d.expected}, {d.actual === null ? 'now not loaded' : `now ${d.actual}`}</li>
      {/each}
    </ul>
    <p class="note">The log replays against the loaded packs, so results may differ from what you saw. Re-enable the original version in the Library to be safe.</p>
  </div>
</div>

<style>
  .drift {
    display: flex;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid color-mix(in srgb, var(--c-warn) 50%, transparent);
    border-left: 4px solid var(--c-warn);
    border-radius: var(--r-xs);
    background: color-mix(in srgb, var(--c-warn) 10%, var(--c-surface-1));
  }
  .drift > :global(svg) {
    flex: none;
    color: var(--c-warn);
    margin-top: 2px;
  }
  .head {
    font-weight: var(--fw-bold);
  }
  ul {
    margin: var(--sp-1) 0;
    font-size: var(--fs-sm);
  }
  .note {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
