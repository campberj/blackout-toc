<script lang="ts">
  import { score, SIDES, type GameState, type Side } from '$lib/app';
  import { humanizeKey } from '$lib/domain/cards/format';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import RoundTrack from '../../components/RoundTrack.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import SideGlyph from '../../components/SideGlyph.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import ToggleChip from '../../components/ToggleChip.svelte';
  import type { BoardController } from './board.svelte';

  /* Top console: game clock, both sides' CP / score / burn cards, and the session commands. */
  interface Props {
    board: BoardController;
    game: GameState;
    onlog: () => void;
    onend: () => void;
  }

  let { board, game, onlog, onend }: Props = $props();

  const marks = $derived([
    ...new Set(game.objectives.flatMap((o) => (o.timing.when === 'end-of-round' ? (o.timing.rounds ?? []) : o.timing.when === 'end-of-game' ? [game.roundLimit] : []))),
  ]);
  const phases = [
    { value: 'operations' as const, label: 'Operations' },
    { value: 'execution' as const, label: 'Execution' },
  ];

  let spendFor = $state<Side | null>(null);
  let spendOpen = $state(false);
  const caps = $derived(Object.entries(game.cpCaps));

  function openSpend(side: Side) {
    spendFor = side;
    spendOpen = true;
  }
  async function spend(reason?: string) {
    if (!spendFor) return;
    spendOpen = false;
    await board.run({ type: 'spendCp', side: spendFor, ...(reason ? { reason } : {}) });
  }
</script>

<section class="console" aria-label="Game status" class:ended={game.ended}>
  <div class="clock">
    <div class="round">
      <span class="r-label">Round <b class="mono">{game.round}</b> of {game.roundLimit}</span>
      <RoundTrack current={game.round} limit={game.roundLimit} {marks} />
    </div>
    <div class="phase">
      <Segmented label="Phase" options={phases} value={game.phase} onchange={(phase) => board.run({ type: 'setPhase', phase })} />
      <Button variant="primary" disabled={game.ended} onclick={() => board.run({ type: 'advanceRound' })}>Next round</Button>
    </div>
    <div class="cmds">
      <Button disabled={!board.undoLabel} onclick={() => board.undo()} title={board.undoLabel ? `Undo: ${board.undoLabel}` : 'Nothing to undo'}>Undo</Button>
      <Button onclick={onlog}>Log <span class="mono count">{board.session?.log.length ?? 0}</span></Button>
      <Button variant="danger" disabled={game.ended} onclick={onend}>End game</Button>
    </div>
  </div>

  {#each SIDES as side (side)}
    {@const s = game.sides[side]}
    <div class="side side-{side}" role="group" aria-label={s.name}>
      <div class="who">
        <SideGlyph {side} size={18} />
        <span class="s-name">{s.name}</span>
        <ToggleChip
          label="Initiative"
          title="{s.name} has initiative"
          pressed={game.initiative === side}
          ontoggle={(on) => board.run({ type: 'setInitiative', side: on ? side : null })}
        />
      </div>
      <div class="stat">
        <span class="lbl">CP</span>
        <div class="line">
          <Stepper
            label="{s.name} command points"
            value={s.cp}
            atMin={s.cp === 0}
            size="lg"
            onstep={(d) => board.run(d < 0 ? { type: 'spendCp', side } : { type: 'adjustCp', side, amount: 1 })}
          />
          <Button onclick={() => openSpend(side)} disabled={s.cp === 0}>Spend</Button>
        </div>
      </div>
      <div class="stat">
        <span class="lbl">{game.scoreLabel}</span>
        <Stepper label="{s.name} {game.scoreLabel} adjustment" value={score(game, side)} size="lg" onstep={(amount) => board.run({ type: 'adjustVp', side, amount })} />
      </div>
      <div class="stat">
        <span class="lbl">Burn</span>
        <Stepper label="{s.name} burn cards" value={s.burnCards} atMin={s.burnCards === 0} onstep={(amount) => board.run({ type: 'adjustBurnCards', side, amount })} />
      </div>
    </div>
  {/each}
</section>

<Dialog bind:open={spendOpen} title={spendFor ? `Spend CP: ${game.sides[spendFor].name}` : 'Spend CP'}>
  {#if spendFor}
    {@const s = game.sides[spendFor]}
    <p class="hint">{s.cp} CP left. Capped uses reset at the start of each round.</p>
    <ul class="reasons" role="list">
      {#each caps as [key, cap] (key)}
        {@const used = s.capUses[key] ?? 0}
        <li>
          <Button block onclick={() => spend(key)}>
            <span class="r-name">{humanizeKey(key)}</span>
            <span class="r-cap mono" class:full={used >= cap}>{used}/{cap} this round</span>
          </Button>
        </li>
      {/each}
      <li><Button block onclick={() => spend('initiative')}>Initiative die</Button></li>
      <li><Button block onclick={() => spend()}>Other</Button></li>
    </ul>
  {/if}
</Dialog>

<style>
  .console {
    display: flex;
    flex-direction: column;
    background: var(--c-surface-1);
    border: 1px solid var(--c-border-strong);
    border-top: 3px solid var(--c-accent);
    border-radius: var(--r-xs);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
  }
  .ended {
    border-top-color: var(--c-border-strong);
  }
  /* Sticky only where height allows (portrait tablet); landscape keeps the board in view instead. */
  @media (min-height: 900px) {
    .console {
      position: sticky;
      z-index: 5;
      top: calc(var(--banner-h) + var(--header-h) + var(--sp-2));
    }
  }

  .clock {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'round round' 'phase cmds';
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border-bottom: 1px solid var(--c-border);
  }
  @media (min-width: 1100px) {
    .clock {
      grid-template-columns: minmax(14rem, 1fr) auto auto;
      grid-template-areas: 'round phase cmds';
    }
  }
  .round {
    grid-area: round;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .round :global(.track) {
    flex: 1;
  }
  .r-label {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    white-space: nowrap;
  }
  .r-label b {
    color: var(--c-text);
    font-size: var(--fs-xl);
  }
  .phase {
    grid-area: phase;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .cmds {
    grid-area: cmds;
    display: flex;
    gap: var(--sp-2);
    justify-content: flex-end;
  }
  .count {
    color: var(--c-text-muted);
  }

  .side {
    display: grid;
    grid-template-columns: minmax(9rem, 1fr) auto auto auto;
    align-items: center;
    gap: var(--sp-2) var(--sp-4);
    padding: var(--sp-2) var(--sp-3);
    border-left: 4px solid var(--side);
  }
  .side + .side {
    border-top: 1px solid var(--c-border);
  }
  .side-player {
    --side: var(--c-info);
  }
  .side-opfor {
    --side: var(--c-crit);
  }
  .who {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: var(--sp-1) var(--sp-2);
    min-width: 0;
  }
  .who :global(.chip) {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .s-name {
    font-weight: var(--fw-bold);
    font-size: var(--fs-lg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 14ch;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .lbl {
    padding-left: var(--sp-1);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
  }
  @media (max-width: 700px) {
    .side {
      grid-template-columns: 1fr 1fr;
    }
    .who {
      grid-column: 1 / -1;
    }
  }

  .hint {
    margin-bottom: var(--sp-3);
    color: var(--c-text-muted);
  }
  .reasons {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .reasons :global(.btn) {
    justify-content: space-between;
  }
  .r-cap {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .r-cap.full {
    color: var(--c-warn);
  }
</style>
