<script lang="ts">
  import type { CardContext, ModelState, UnitState } from '$lib/app';
  import CardView from '../../components/card/CardView.svelte';
  import PipTrack from '../../components/PipTrack.svelte';
  import ToggleChip from '../../components/ToggleChip.svelte';
  import { toasts } from '../../components/toast.svelte';
  import type { BoardController } from './board.svelte';
  import { strength, trackerCommand, unitView } from './board';
  import ModelChips from './ModelChips.svelte';

  /*
   * Unit in play. Player side: the shared card (compact, live) + model chips.
   * Condensed (OPFOR): header, tokens, model chips and any limited-use boxes only.
   */
  interface Props {
    board: BoardController;
    unit: UnitState;
    ctx: CardContext | null;
    condensed?: boolean;
    onpick: (unit: UnitState, model: ModelState) => void;
  }

  let { board, unit, ctx, condensed = false, onpick }: Props = $props();

  const view = $derived(unitView(unit, ctx));
  const str = $derived(strength(unit));
  const wiped = $derived(str.up === 0);

  function token(t: 'activated' | 'pinned', value: boolean) {
    void board.run({ type: 'setToken', unit: unit.key, token: t, value });
  }
  function drill() {
    if (unit.drillUsed) toasts.push('Drill already used this round. Use Undo to take it back.', 'info');
    else void board.run({ type: 'useDrill', unit: unit.key });
  }
</script>

<article class="tile" class:condensed class:activated={unit.activated} class:wiped aria-label={unit.name}>
  <header class="bar">
    {#if condensed}
      <div class="title">
        <h3 class="name">{unit.name}</h3>
        <span class="str mono" title="Models still in the fight">{str.up}/{str.total}</span>
      </div>
    {/if}
    <div class="tokens">
      <ToggleChip label="Activated" pressed={unit.activated} ontoggle={(v) => token('activated', v)} />
      <ToggleChip label="Pinned" tone="warn" pressed={unit.pinned} ontoggle={(v) => token('pinned', v)} />
      {#if unit.forceId}
        <ToggleChip label="Drill" title="Battle drill (1 CP)" tone="info" pressed={unit.drillUsed} ontoggle={drill} />
      {/if}
    </div>
  </header>

  {#key board.rev}
    {#if condensed}
      {#if unit.combatLoads > 0 || unit.rules.length > 0}
        <div class="boxes">
          {#if unit.combatLoads > 0}
            <div class="box-row">
              <span>Loads</span>
              <PipTrack label="{unit.name} combat loads used" max={unit.combatLoads} shape="box" tone="warn" showCount={false} value={unit.loadsUsed} onchange={(used) => board.run({ type: 'setLoads', unit: unit.key, used })} />
            </div>
          {/if}
          {#each unit.rules as r (r.key)}
            <div class="box-row">
              <span>{r.name}</span>
              <PipTrack label="{r.name} uses" max={r.usesMax} shape="box" tone="info" showCount={false} value={unit.ruleUses[r.key] ?? 0} onchange={(ticked) => board.run({ type: 'setRuleBoxes', unit: unit.key, rule: r.key, ticked })} />
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <CardView
        card={view.card}
        variant="compact"
        tracker={view.tracker}
        ontrack={(c) => {
          const cmd = trackerCommand(unit, view, c);
          if (cmd) void board.run(cmd);
        }}
      />
    {/if}
  {/key}

  <div class="models">
    <ModelChips {unit} onpick={(m) => onpick(unit, m)} />
  </div>
</article>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-width: 0;
    padding: var(--sp-2);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  /* Activated units step back so the ones still to act stand out. */
  .activated {
    background: color-mix(in srgb, var(--c-surface-1) 70%, var(--c-bg));
  }
  .activated :global(.card) {
    opacity: 0.78;
  }
  .wiped {
    border-style: dashed;
  }
  .bar {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: 0 var(--sp-1);
  }
  .name {
    font-size: var(--fs-md);
  }
  .str {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .tokens {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .boxes {
    display: flex;
    flex-direction: column;
    padding: 0 var(--sp-1);
  }
  .box-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    font-size: var(--fs-sm);
  }
  .models {
    padding-top: var(--sp-1);
  }
</style>
