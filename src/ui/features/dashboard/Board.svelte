<script lang="ts">
  import { unitsOf, type ModelState, type Side, type UnitState } from '$lib/app';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Panel from '../../components/Panel.svelte';
  import SideGlyph from '../../components/SideGlyph.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import AddUnitDialog from './AddUnitDialog.svelte';
  import { BoardController } from './board.svelte';
  import Console from './Console.svelte';
  import GameSummary from './GameSummary.svelte';
  import LogDrawer from './LogDrawer.svelte';
  import ModelSheet from './ModelSheet.svelte';
  import ScenarioPanel from './ScenarioPanel.svelte';
  import UnitTile from './UnitTile.svelte';

  /* Live board for one session: console, player force, OPFOR, scenario; log and dialogs on demand. */
  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  const app = useAppState();
  // svelte-ignore state_referenced_locally (keyed by id in the parent)
  const board = new BoardController(app.ctx.sessions, id);
  void board.load();

  const game = $derived(board.state);
  const cardCtx = $derived.by(() => {
    void app.snapshot;
    void app.activeRulesetId;
    return app.context ? { lookup: app.snapshot!.registry, rulesetId: (game?.rulesetId as never) ?? app.activeRulesetId } : null;
  });
  const player = $derived(game ? unitsOf(game, 'player') : []);
  const opfor = $derived(game ? unitsOf(game, 'opfor') : []);
  const unitCards = $derived(app.registry?.list('unit') ?? []);

  let pick = $state<{ unit: string; model: string } | null>(null);
  let logOpen = $state(false);
  let addOpen = $state(false);
  let addSide = $state<Side>('opfor');
  let endOpen = $state(false);
  let overOpen = $state(false);

  function onpick(u: UnitState, m: ModelState) {
    pick = { unit: u.key, model: m.key };
  }
  function openAdd(side: Side) {
    addSide = side;
    addOpen = true;
  }
  async function confirmEnd() {
    endOpen = false;
    if ((await board.end()) !== false) overOpen = true;
  }
  const aarQuery = $derived(game?.link ? { save: game.link.campaignSaveId, aar: game.link.mission } : null);
  const toAar = () => aarQuery && router.go('/campaign', aarQuery);
</script>

{#if board.error}
  <EmptyState title="This game could not be opened" message={board.error} icon="alert">
    {#snippet action()}<Button variant="primary" onclick={() => router.go('/dashboard')}>Back to games</Button>{/snippet}
  </EmptyState>
{:else if game}
  <div class="board">
    <header class="head">
      <div>
        <a class="back" href={href('/dashboard')}>All games</a>
        <h1 class="title">{game.name}</h1>
      </div>
      {#if game.link}<span class="linked">Campaign mission</span>{/if}
    </header>

    <Console {board} {game} onlog={() => (logOpen = true)} onend={() => (endOpen = true)} />

    {#if game.ended}
      <section class="over" aria-label="Game over">
        <GameSummary {game} />
        <div class="over-actions">
          {#if aarQuery}<Button variant="primary" size="lg" onclick={toAar}>Return to campaign AAR</Button>{/if}
          <Button onclick={() => board.undo()}>Reopen game</Button>
        </div>
      </section>
    {/if}

    <div class="grid">
      <section class="force" aria-labelledby="force-h">
        <div class="sec-head">
          <h2 id="force-h" class="sec-title"><SideGlyph side="player" size={18} /> {game.sides.player.name}</h2>
          <Button onclick={() => openAdd('player')} disabled={game.ended}>Add unit</Button>
        </div>
        {#if player.length === 0}
          <EmptyState title="No units on your side" message="Add units from loaded cards or as custom contacts." icon="roster" />
        {:else}
          <div class="tiles">
            {#each player as u (u.key)}
              <UnitTile {board} unit={u} ctx={cardCtx} {onpick} />
            {/each}
          </div>
        {/if}
      </section>

      <aside class="side-col">
        <Panel title={game.sides.opfor.name} level={2}>
          {#snippet actions()}
            <Button onclick={() => openAdd('opfor')} disabled={game.ended}>Add OPFOR</Button>
          {/snippet}
          {#if opfor.length === 0}
            <p class="muted">No OPFOR yet. Add hostiles from unit cards or as custom contacts.</p>
          {:else}
            <div class="opfor">
              {#each opfor as u (u.key)}
                <UnitTile {board} unit={u} ctx={cardCtx} condensed {onpick} />
              {/each}
            </div>
          {/if}
        </Panel>
        <ScenarioPanel {board} {game} />
      </aside>
    </div>
  </div>

  <ModelSheet {board} unitKey={pick?.unit ?? null} modelKey={pick?.model ?? null} onclose={() => (pick = null)} />
  <LogDrawer {board} bind:open={logOpen} />
  <AddUnitDialog {board} side={addSide} units={unitCards} bind:open={addOpen} />

  <Dialog bind:open={endOpen} title="End the game?">
    <p class="lead">This locks the board. Undo reopens it if you end by mistake.</p>
    <GameSummary {game} />
    {#snippet actions()}
      <Button onclick={() => (endOpen = false)}>Keep playing</Button>
      <Button variant="danger" onclick={confirmEnd}>End game</Button>
    {/snippet}
  </Dialog>

  <Dialog bind:open={overOpen} title="Game over">
    <GameSummary {game} />
    {#snippet actions()}
      <Button onclick={() => router.go('/dashboard')}>Back to games</Button>
      {#if aarQuery}<Button variant="primary" onclick={toAar}>Return to campaign AAR</Button>{/if}
    {/snippet}
  </Dialog>

  <Dialog open={board.pending !== null} title="Over the limit" onclose={() => (board.pending = null)}>
    <p>{board.pending?.message}.</p>
    <p class="muted">Do it anyway? The log will record it.</p>
    {#snippet actions()}
      <Button onclick={() => (board.pending = null)}>Cancel</Button>
      <Button variant="primary" onclick={() => board.confirmForce()}>Do it anyway</Button>
    {/snippet}
  </Dialog>
{:else}
  <p class="muted" aria-live="polite">Opening game…</p>
{/if}

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--sp-3);
  }
  .back {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    font-size: var(--fs-sm);
  }
  .title {
    font-size: var(--fs-2xl);
  }
  .linked {
    padding: var(--sp-1) var(--sp-3);
    border: 1px solid var(--c-accent);
    border-radius: var(--r-sm);
    color: var(--c-accent);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .over {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-4);
    border: 1px solid var(--c-border-strong);
    border-left: 4px solid var(--c-accent);
    background: var(--c-surface-1);
  }
  .over-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .grid {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: minmax(0, 1fr);
  }
  @media (orientation: landscape) and (min-width: 1000px) {
    .grid {
      grid-template-columns: minmax(0, 1.55fr) minmax(20rem, 1fr);
      align-items: start;
    }
  }
  .force {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  .sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
  }
  .sec-title {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-lg);
  }
  .tiles {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
    align-items: start;
  }
  .side-col {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: 0;
  }
  .opfor {
    display: grid;
    gap: var(--sp-2);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
  }
  .muted {
    color: var(--c-text-muted);
  }
  .lead {
    margin-bottom: var(--sp-4);
  }
</style>
