<script lang="ts">
  import { dueObjectives, SIDES, timingText, type GameState, type Side } from '$lib/app';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Panel from '../../components/Panel.svelte';
  import SideGlyph from '../../components/SideGlyph.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import ToggleChip from '../../components/ToggleChip.svelte';
  import type { BoardController } from './board.svelte';

  /* Objectives (tap to score per side), scoring reminders, and special rules (display only). */
  interface Props {
    board: BoardController;
    game: GameState;
  }

  let { board, game }: Props = $props();

  const due = $derived(dueObjectives(game));
  const sidesFor = (o: GameState['objectives'][number]): Side[] => (o.side ? [o.side] : [...SIDES]);
  const pts = (n: number) => `${n > 0 ? '+' : ''}${n} ${game.scoreLabel}`;

  let label = $state('');
  let points = $state(1);
  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    if (await board.run({ type: 'addObjective', label: label.trim(), points })) {
      label = '';
      points = 1;
    }
  }
</script>

<Panel title={game.scenarioName ?? 'Objectives'} level={2}>
  <div class="wrap">
    {#if due.length > 0 && !game.ended}
      <p class="due" role="status">
        <b>Score at the end of this round:</b>
        {due.map((o) => o.label).join(', ')}
      </p>
    {/if}

    {#if game.objectives.length === 0}
      <p class="muted">No objectives yet. Add the ones you are playing for below.</p>
    {:else}
      <ul class="objs" role="list">
        {#each game.objectives as o (o.key)}
          {@const when = timingText(o)}
          <li class="obj" class:is-due={due.includes(o)}>
            <div class="o-head">
              <span class="o-label">{o.label}</span>
              <span class="o-pts mono">{pts(o.points)}{#if o.max && o.max > 1}<span class="muted"> ×{o.max} max</span>{/if}</span>
            </div>
            {#if when || o.text}
              <p class="o-sub">{[when, o.text].filter(Boolean).join('. ')}</p>
            {/if}
            <div class="o-score">
              {#each sidesFor(o) as side (side)}
                {@const n = o.scored[side]}
                {#if o.max === 1}
                  <ToggleChip
                    label={game.sides[side].name}
                    title="{game.sides[side].name} scored {o.label}"
                    tone={side === 'player' ? 'info' : 'crit'}
                    pressed={n > 0}
                    disabled={game.ended}
                    ontoggle={(on) => board.run({ type: 'scoreObjective', objective: o.key, side, delta: on ? 1 : -1 })}
                  />
                {:else}
                  <div class="tally">
                    <SideGlyph {side} />
                    <Stepper
                      label="{game.sides[side].name} {o.label}"
                      value={n}
                      atMin={n === 0 || game.ended}
                      atMax={(o.max !== undefined && n >= o.max) || game.ended}
                      onstep={(delta) => board.run({ type: 'scoreObjective', objective: o.key, side, delta })}
                    />
                  </div>
                {/if}
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if !game.ended}
      <form class="add" onsubmit={add}>
        <Field label="Objective">
          {#snippet control(a)}<input class="control" {...a} bind:value={label} maxlength="80" placeholder="e.g. Hold the relay" />{/snippet}
        </Field>
        <Field label="Points">
          {#snippet control(a)}<input class="control pts" type="number" min="-99" max="99" {...a} bind:value={points} />{/snippet}
        </Field>
        <Button type="submit" disabled={!label.trim()}>Add</Button>
      </form>
    {/if}

    {#if game.specialRules.length > 0}
      <section class="rules" aria-label="Special rules">
        <h3 class="h">Special rules</h3>
        {#each game.specialRules as r (r.key)}
          <details class="rule">
            <summary>{r.name}</summary>
            {#if r.text}<p>{r.text}</p>{/if}
          </details>
        {/each}
      </section>
    {/if}
  </div>
</Panel>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .muted {
    color: var(--c-text-muted);
  }
  .due {
    padding: var(--sp-2) var(--sp-3);
    border-left: 4px solid var(--c-warn);
    background: color-mix(in srgb, var(--c-warn) 12%, transparent);
  }
  .objs {
    display: flex;
    flex-direction: column;
  }
  .obj {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-3) 0;
  }
  .obj + .obj {
    border-top: 1px solid var(--c-border);
  }
  .is-due .o-label {
    color: var(--c-warn);
  }
  .o-head {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
  }
  .o-label {
    font-weight: var(--fw-bold);
  }
  .o-pts {
    color: var(--c-accent);
    white-space: nowrap;
  }
  .o-sub {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .o-score {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-4);
    padding-top: var(--sp-1);
  }
  .tally {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .add {
    display: grid;
    grid-template-columns: 1fr 5.5rem auto;
    align-items: end;
    gap: var(--sp-2);
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .h {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .rule summary {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    font-weight: var(--fw-medium);
    cursor: pointer;
  }
  .rule p {
    padding-bottom: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
