<script lang="ts">
  /*
   * Side marker borrowed from map symbology: friendly = rectangle frame, hostile = diamond.
   * Shape carries the meaning, so color is never the only cue.
   */
  interface Props {
    side: 'player' | 'opfor';
    size?: number;
  }

  let { side, size = 16 }: Props = $props();
</script>

<svg class="glyph {side}" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  {#if side === 'player'}
    <rect x="1.5" y="3.5" width="13" height="9" />
  {:else}
    <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" />
  {/if}
</svg>

<style>
  .glyph {
    flex: none;
    fill: color-mix(in srgb, currentColor 22%, transparent);
    stroke: currentColor;
    stroke-width: 1.75;
  }
  .player {
    color: var(--c-info);
  }
  .opfor {
    color: var(--c-crit);
  }
</style>
