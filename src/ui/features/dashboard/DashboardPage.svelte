<script lang="ts">
  import { router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import Board from './Board.svelte';
  import SessionList from './SessionList.svelte';

  // #/dashboard → games list + new game; #/dashboard?session=<id> → live board.
  const app = useAppState();
  const session = $derived(router.query.session);
</script>

{#if session && app.status === 'ready'}
  {#key session}
    <Board id={session} />
  {/key}
{:else if session}
  <p aria-live="polite">Opening game…</p>
{:else}
  <SessionList />
{/if}
