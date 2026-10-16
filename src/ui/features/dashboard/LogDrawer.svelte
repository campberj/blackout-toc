<script lang="ts">
  import type { LogEntry } from '$lib/app';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import type { BoardController } from './board.svelte';

  /* Game log, newest first, grouped by round, with a note field. */
  interface Props {
    board: BoardController;
    open: boolean;
  }

  let { board, open = $bindable() }: Props = $props();

  const rounds = $derived.by(() => {
    const out: [number, LogEntry[]][] = [];
    for (const e of [...(board.session?.log ?? [])].reverse()) {
      const last = out.at(-1);
      if (last && last[0] === e.round) last[1].push(e);
      else out.push([e.round, [e]]);
    }
    return out;
  });

  let note = $state('');
  async function addNote(e: SubmitEvent) {
    e.preventDefault();
    const text = note.trim();
    if (text && (await board.run({ type: 'note', text }))) note = '';
  }
</script>

<Dialog bind:open title="Game log">
  <form class="note" onsubmit={addNote}>
    <label class="sr" for="log-note">Note</label>
    <input id="log-note" class="control" bind:value={note} maxlength="280" placeholder="Add a note to the log" />
    <Button type="submit" variant="primary" disabled={!note.trim()}>Add note</Button>
  </form>
  {#each rounds as [round, entries] (round)}
    <section class="round" aria-label="Round {round}">
      <h3 class="h">Round {round}</h3>
      <ol class="entries" role="list">
        {#each entries as e (e.seq)}
          <li class:note={e.type === 'Note'}>{e.text}</li>
        {/each}
      </ol>
    </section>
  {/each}
</Dialog>

<style>
  .note {
    display: flex;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .round + .round {
    margin-top: var(--sp-4);
  }
  .h {
    position: sticky;
    top: calc(-1 * var(--sp-5));
    padding: var(--sp-1) 0;
    background: var(--c-surface-1);
    color: var(--c-accent);
    font-size: var(--fs-sm);
    border-bottom: 1px solid var(--c-border);
  }
  .entries li {
    padding: var(--sp-2) 0;
    font-size: var(--fs-sm);
  }
  .entries li + li {
    border-top: 1px dotted var(--c-border);
  }
  .entries .note {
    padding-left: var(--sp-3);
    border-left: 3px solid var(--c-accent);
    font-style: italic;
  }
</style>
