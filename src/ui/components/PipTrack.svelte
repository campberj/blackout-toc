<script lang="ts" module>
  export type PipTone = 'accent' | 'ok' | 'warn' | 'crit' | 'info';
</script>

<script lang="ts">
  /*
   * n pips, `value` filled. Tap pip i to set value = i; tap the last filled pip
   * to clear it (value = i - 1). One tab stop; arrows / Home / End adjust.
   * Used for damage tracks, combat loads, rule use-boxes, CP.
   */
  interface Props {
    label: string;
    max: number;
    value?: number;
    tone?: PipTone;
    /** 'pip' = round (resources); 'box' = square, crossed when filled (use-boxes, damage). */
    shape?: 'pip' | 'box';
    readonly?: boolean;
    /** Show "3/5" readout next to the track. */
    showCount?: boolean;
    /** Small, non-touch sizing for print / dense read-only layouts. */
    dense?: boolean;
    onchange?: (value: number) => void;
  }

  let {
    label,
    max,
    value = $bindable(0),
    tone = 'accent',
    shape = 'pip',
    readonly = false,
    showCount = true,
    dense = false,
    onchange,
  }: Props = $props();

  let buttons: HTMLButtonElement[] = $state([]);
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  // Roving focus target: the last filled pip, or the first if empty.
  const focusIndex = $derived(Math.max(0, Math.min(max - 1, value - 1)));

  function set(v: number) {
    const next = clamp(v);
    if (readonly || next === value) return;
    value = next;
    onchange?.(next);
  }

  function tap(i: number) {
    set(value === i ? i - 1 : i);
  }

  function onkeydown(e: KeyboardEvent) {
    const map: Record<string, number> = {
      ArrowRight: value + 1,
      ArrowUp: value + 1,
      ArrowLeft: value - 1,
      ArrowDown: value - 1,
      Home: 0,
      End: max,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    set(next);
    buttons[Math.max(0, Math.min(max - 1, clamp(next) - 1))]?.focus();
  }
</script>

<div class="track shape-{shape} tone-{tone}" class:readonly class:dense role="group" aria-label="{label}: {value} of {max}">
  <!-- svelte-ignore a11y_no_static_element_interactions (keys delegated from the pip buttons) -->
  <div class="pips" {onkeydown}>
    {#each { length: max }, idx (idx)}
      {@const i = idx + 1}
      <button
        bind:this={buttons[idx]}
        type="button"
        class="pip"
        class:filled={i <= value}
        aria-pressed={i <= value}
        aria-label="{label} {i}"
        tabindex={idx === focusIndex ? 0 : -1}
        disabled={readonly}
        onclick={() => tap(i)}
      >
        <span class="mark" aria-hidden="true"></span>
      </button>
    {/each}
  </div>
  {#if showCount}
    <span class="count mono" aria-hidden="true">{value}/{max}</span>
  {/if}
</div>

<style>
  .track {
    --tone: var(--c-accent);
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    max-width: 100%;
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

  .pips {
    display: flex;
    flex-wrap: wrap;
  }

  /* 44px hit area around a smaller visual mark. */
  .pip {
    display: grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    border-radius: var(--r-sm);
    touch-action: manipulation;
  }
  /* Pull the first mark flush with surrounding text without shrinking hit areas. */
  .pip:first-child {
    margin-inline-start: -11px;
  }
  .pip:focus-visible {
    outline: none;
  }
  .pip:focus-visible .mark {
    box-shadow: var(--focus-ring);
  }
  .pip:disabled {
    cursor: default;
  }

  .mark {
    position: relative;
    width: 1.375rem;
    height: 1.375rem;
    border: 2px solid var(--c-border-strong);
    background: var(--c-surface-2);
    transition:
      background-color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }
  .shape-pip .mark {
    border-radius: var(--r-pill);
  }
  .shape-box .mark {
    border-radius: var(--r-xs);
  }
  .pip:not(:disabled):hover .mark {
    border-color: var(--tone);
  }

  .filled .mark {
    border-color: var(--tone);
    background: var(--tone);
  }
  /* Boxes read as "crossed off", so draw an X instead of a solid fill. */
  .shape-box .filled .mark {
    background: color-mix(in srgb, var(--tone) 22%, var(--c-surface-2));
  }
  .shape-box .filled .mark::before,
  .shape-box .filled .mark::after {
    content: '';
    position: absolute;
    inset: 45% -1px auto;
    height: 2px;
    background: var(--tone);
    transform: rotate(45deg);
  }
  .shape-box .filled .mark::after {
    transform: rotate(-45deg);
  }

  .dense .pip {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0 2px 0 0;
  }
  /* Dense is for paper: empty boxes to tick by hand, ink outline only. */
  .dense .mark {
    width: 0.9rem;
    height: 0.9rem;
    border-width: 1.5px;
    border-color: currentColor;
    background: transparent;
  }

  .count {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    min-width: 3ch;
  }

  @media print {
    .mark {
      border-color: #000 !important;
      background: #fff !important;
    }
  }
</style>
