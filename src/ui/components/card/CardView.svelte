<script lang="ts">
  import PipTrack from '../PipTrack.svelte';
  import type { CardTrackerState, CardVariant, CardViewModel } from '$lib/app/view-models/card-view-model';

  /*
   * Shared unit-card renderer (builder, forge, dashboard, print).
   * Pass `tracker` (bindable) to make use-boxes, loads and damage tappable;
   * without it the boxes render empty and read-only (reference / print).
   */
  interface Props {
    card: CardViewModel;
    variant?: CardVariant;
    tracker?: CardTrackerState;
  }

  let { card, variant = 'full', tracker = $bindable() }: Props = $props();

  const uid = $props.id();
  const live = $derived(tracker !== undefined && variant !== 'print');
  const compact = $derived(variant === 'compact');
  const Heading = $derived(compact ? 'h3' : 'h2');

  function setRuleUse(i: number, v: number) {
    if (tracker) tracker.ruleUses[i] = v;
  }
  function setDamage(i: number, v: number) {
    if (tracker) tracker.damage[i] = v;
  }
  function setLoads(v: number) {
    if (tracker) tracker.combatLoadsUsed = v;
  }
</script>

<article class="card {variant}" class:print-card={variant === 'print'} aria-labelledby="{uid}-n">
  <header class="head">
    <div class="ident">
      <p class="type">
        {card.type}{#if card.custom}<span class="custom">Custom</span>{/if}
      </p>
      <svelte:element this={Heading} id="{uid}-n" class="name">{card.name}</svelte:element>
      {#if !compact}<p class="faction">{card.faction}</p>{/if}
    </div>
  </header>

  <dl class="statline mono">
    {#each card.stats as s, i (i)}
      <div class="cell"><dt>{s.label}</dt><dd>{s.value}</dd></div>
    {/each}
    <div class="cell"><dt>Armor</dt><dd>{card.armor}</dd></div>
    {#if card.grunts > 0 || !compact}
      <div class="cell"><dt>Grunts</dt><dd>{card.grunts}</dd></div>
    {/if}
  </dl>

  <div class="body">
    {#if card.damageTracks.length > 0}
      <section class="sec" aria-label="Damage">
        {#each card.damageTracks as t, i (i)}
          <div class="track-row">
            <span class="track-name">{t.name}</span>
            <PipTrack
              label="{card.name} {t.name}"
              max={t.size}
              shape="box"
              tone="crit"
              readonly={!live}
              dense={variant === 'print'}
              showCount={live}
              value={tracker?.damage[i] ?? 0}
              onchange={(v) => setDamage(i, v)}
            />
          </div>
        {/each}
      </section>
    {/if}

    {#if card.combatLoads > 0}
      <div class="track-row">
        <span class="track-name">Combat loads</span>
        <PipTrack
          label="{card.name} combat loads used"
          max={card.combatLoads}
          shape="box"
          tone="warn"
          readonly={!live}
              dense={variant === 'print'}
          showCount={live}
          value={tracker?.combatLoadsUsed ?? 0}
          onchange={setLoads}
        />
      </div>
    {/if}

    <section class="sec">
      <h4 class="sec-title">Weapons</h4>
      <ul class="weapons" role="list">
        {#each card.weapons as w, i (i)}
          <li><span class="w-name">{w.name}</span> <span class="w-prof mono">{w.profile}</span></li>
        {/each}
      </ul>
    </section>

    {#if card.specialists.length > 0}
      <section class="sec">
        <h4 class="sec-title">Specialists</h4>
        <ul class="rules" role="list">
          {#each card.specialists as sp, i (i)}
            <li>
              <span class="r-name">{sp.name}</span>
              {#if sp.text && !compact}<p class="r-text">{sp.text}</p>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if card.rules.length > 0}
      <section class="sec">
        <h4 class="sec-title">Rules</h4>
        <ul class="rules" role="list">
          {#each card.rules as r, i (i)}
            <li>
              <div class="r-head">
                <span class="r-name">{r.name}</span>
                {#if r.usesMax}
                  <PipTrack
                    label="{r.name} uses"
                    max={r.usesMax}
                    shape="box"
                    tone="info"
                    readonly={!live}
              dense={variant === 'print'}
                    showCount={false}
                    value={tracker?.ruleUses[i] ?? 0}
                    onchange={(v) => setRuleUse(i, v)}
                  />
                {/if}
              </div>
              {#if !compact}<p class="r-text">{r.text}</p>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if card.keywords?.length && !compact}
      <p class="keywords">{card.keywords.join(', ')}</p>
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

  /* Header plate: notched corner reads as a stamped ID plate, not a generic card. */
  .head {
    position: relative;
    padding: var(--sp-3) var(--sp-4) var(--sp-3);
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
  .custom {
    margin-left: var(--sp-2);
    padding: 0 var(--sp-1);
    border: 1px solid var(--c-border-strong);
    color: var(--c-text-muted);
    font-weight: var(--fw-regular);
  }
  .name {
    font-size: var(--fs-xl);
    line-height: var(--lh-tight);
  }
  .faction {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  .statline {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    border-bottom: 1px solid var(--c-border);
  }
  .cell {
    padding: var(--sp-2) var(--sp-3);
    text-align: center;
  }
  .cell + .cell {
    border-left: 1px solid var(--c-border);
  }
  .cell dt {
    color: var(--c-text-muted);
    font-family: var(--font-sans);
    font-size: var(--fs-xs);
  }
  .cell dd {
    margin: 0;
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    line-height: 1.15;
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

  .track-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    min-height: var(--touch);
  }
  .track-name {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }

  .weapons li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    column-gap: var(--sp-3);
    padding: var(--sp-1) 0;
  }
  .weapons li + li {
    border-top: 1px dotted var(--c-border);
  }
  .w-name {
    font-weight: var(--fw-medium);
  }
  .w-prof {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    white-space: pre;
  }

  .rules {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .r-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    min-height: 1.75rem;
  }
  .r-name {
    font-weight: var(--fw-bold);
    font-size: var(--fs-sm);
  }
  .r-text {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .keywords {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
  }

  /* Compact: dashboard tiles, denser type. */
  .compact .head {
    padding: var(--sp-2) var(--sp-3);
  }
  .compact .name {
    font-size: var(--fs-lg);
  }
  .compact .cell dd {
    font-size: var(--fs-lg);
  }
  .compact .body {
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
  }

  /* Print: fixed-ish physical width, ink-friendly. */
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
  .print .cell dt,
  .print .sec-title,
  .print .r-text,
  .print .w-prof,
  .print .keywords {
    color: #222;
  }
  .print .name {
    font-size: 13pt;
  }
  .print .cell dd {
    font-size: 12pt;
  }
  .print .track-row {
    min-height: 0;
  }
</style>
