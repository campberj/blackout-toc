<script lang="ts" module>
  export interface MeterTick {
    /** 0..1 along the meter. */
    pos: number;
    label: string;
    /** Value shown under the tick. */
    at: number | string;
    reached: boolean;
  }
</script>

<script lang="ts">
  /*
   * Read-only segmented meter: one cell per point, milestone ticks on cell boundaries.
   * Used for campaign tracks; numeric readout + aria text so it never relies on fill alone.
   */
  interface Props {
    label: string;
    value: number;
    min?: number;
    max: number;
    ticks?: readonly MeterTick[];
    tone?: 'accent' | 'ok' | 'warn' | 'crit' | 'info';
    /** Extra line under the meter (e.g. next milestone). */
    caption?: string | undefined;
  }

  let { label, value, min = 0, max, ticks = [], tone = 'accent', caption }: Props = $props();
  const cells = $derived(Array.from({ length: Math.max(1, max - min) }, (_, i) => min + i + 1));
  const uid = $props.id();
</script>

<div class="meter tone-{tone}" role="meter" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-labelledby="{uid}-l" aria-describedby={caption ? `${uid}-c` : undefined}>
  <div class="head">
    <span id="{uid}-l" class="label">{label}</span>
    <span class="read mono"><strong>{value}</strong><span class="of">/{max}</span></span>
  </div>
  <div class="track">
    <div class="cells" style:--n={cells.length}>
      {#each cells as v (v)}
        <span class="cell" class:on={v <= value}></span>
      {/each}
    </div>
    {#each ticks as t (t.pos)}
      <span class="tick" class:reached={t.reached} style:left="{t.pos * 100}%" title="{t.label} ({t.at})">
        <span class="at mono">{t.at}</span>
      </span>
    {/each}
  </div>
  {#if caption}<p id="{uid}-c" class="caption">{caption}</p>{/if}
</div>

<style>
  .meter {
    --tone: var(--c-accent);
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    min-width: 0;
  }
  .tone-ok {
    --tone: var(--c-ok);
  }
  .tone-warn {
    --tone: var(--c-warn);
  }
  .tone-crit {
    --tone: var(--c-crit);
  }
  .tone-info {
    --tone: var(--c-info);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .label {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .read strong {
    font-size: var(--fs-lg);
  }
  .of {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .track {
    position: relative;
    padding-bottom: 1.1rem; /* room for tick values */
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    gap: 2px;
    height: 0.875rem;
  }
  .cell {
    background: var(--c-surface-3);
    border: 1px solid var(--c-border);
  }
  .cell.on {
    background: var(--tone);
    border-color: var(--tone);
  }
  .tick {
    position: absolute;
    top: -3px;
    width: 2px;
    height: calc(0.875rem + 6px);
    margin-left: -1px;
    background: var(--c-text-muted);
  }
  .tick.reached {
    background: var(--c-text);
  }
  .at {
    position: absolute;
    top: calc(100% + 1px);
    left: 50%;
    transform: translateX(-50%);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1;
  }
  .caption {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  @media (forced-colors: active) {
    .cell.on {
      background: CanvasText;
    }
  }
</style>
