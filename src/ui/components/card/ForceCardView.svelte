<script lang="ts">
  import PipTrack from '../PipTrack.svelte';
  import type { CardVariant } from '$lib/app/view-models/card-view-model';
  import type { ForceArmoryVM, ForceCardViewModel } from '$lib/app/view-models/force-card-view-model';

  /* Force card: force rule, battle drills, armory. Read-only; shares CardView's visual language. */
  interface Props {
    card: ForceCardViewModel;
    variant?: CardVariant;
  }
  let { card, variant = 'full' }: Props = $props();
  const uid = $props.id();
  const compact = $derived(variant === 'compact');
</script>

{#snippet items(list: ForceArmoryVM[])}
  <ul class="items" role="list">
    {#each list as it, i (i)}
      <li>
        <div class="i-head">
          <span class="i-name">{it.name}</span>
          {#if it.profile}<span class="mono i-prof">{it.profile}</span>{/if}
          {#if it.cost}<span class="mono i-prof">{it.cost}</span>{/if}
          {#if it.usesMax}<PipTrack label="{it.name} uses" max={it.usesMax} shape="box" tone="info" readonly showCount={false} value={0} />{/if}
        </div>
        {#if it.text && !compact}<p class="i-text">{it.text}</p>{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<article class="card force {variant}" aria-labelledby="{uid}-n">
  <header class="head">
    <p class="type">Force</p>
    <svelte:element this={compact ? 'h3' : 'h2'} id="{uid}-n" class="name">{card.name}</svelte:element>
    {#if !compact}<p class="faction">{card.faction}</p>{/if}
  </header>

  <div class="body">
    <section class="sec">
      <h4 class="sec-title">Force rule</h4>
      <p class="i-text">{card.forceRule}</p>
    </section>

    {#if card.battleDrills.length > 0}
      <section class="sec">
        <h4 class="sec-title">Battle drills</h4>
        {@render items(card.battleDrills.map((d) => ({ kind: 'ability', profile: '', ...d })))}
      </section>
    {/if}

    {#if card.armory.length > 0}
      <section class="sec">
        <h4 class="sec-title">Armory</h4>
        {@render items(card.armory)}
      </section>
    {/if}

    {#if card.dusterArmory.length > 0}
      <section class="sec">
        <h4 class="sec-title">Duster armory</h4>
        {@render items(card.dusterArmory)}
      </section>
    {/if}
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--c-surface-1);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    overflow: hidden;
  }
  .head {
    padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface-3);
    border-bottom: 1px solid var(--c-border-strong);
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
  }
  .type {
    color: var(--c-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
  }
  .name {
    font-size: var(--fs-xl);
    line-height: var(--lh-tight);
  }
  .faction {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
  .sec {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .sec-title {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
    border-bottom: 1px solid var(--c-border);
    padding-bottom: 2px;
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .i-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--sp-3);
  }
  .i-name {
    flex: 1;
    font-weight: var(--fw-bold);
    font-size: var(--fs-sm);
  }
  .i-prof {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .i-text {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .compact .head {
    padding: var(--sp-2) var(--sp-3);
  }
  .compact .name {
    font-size: var(--fs-lg);
  }
  .compact .body {
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
  }
  .print {
    border: 1px solid #000;
    border-radius: 0;
    background: #fff;
    color: #000;
    font-size: 9pt;
    break-inside: avoid;
  }
  .print .head {
    background: #e8e8e8;
    border-bottom-color: #000;
    clip-path: none;
  }
  .print .type,
  .print .faction,
  .print .sec-title,
  .print .i-prof,
  .print .i-text {
    color: #222;
  }
  .print .name {
    font-size: 13pt;
  }
</style>
