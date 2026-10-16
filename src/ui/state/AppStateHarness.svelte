<script lang="ts">
  import type { Component } from 'svelte';
  import type { AppContext } from '../../app';
  import { provideAppState } from './app-context.svelte';

  /* Test-only root: provides AppState from a custom boot (in-memory storage, fixture packs). */
  interface Props {
    boot: () => Promise<AppContext>;
    page: Component;
  }

  let { boot, page: PageComponent }: Props = $props();
  // svelte-ignore state_referenced_locally
  const app = provideAppState(boot);
</script>

{#if app.status !== 'loading'}<PageComponent />{/if}
