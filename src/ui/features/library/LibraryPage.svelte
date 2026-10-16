<script lang="ts">
  import { formatLoadError, type PackInfo } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import Page from '../../shell/Page.svelte';
  import Tabs from '../../components/Tabs.svelte';
  import Panel from '../../components/Panel.svelte';
  import JsonImport from '../../components/JsonImport.svelte';
  import { toasts } from '../../components/toast.svelte';
  import PackList from './PackList.svelte';
  import LoadRecovery from './LoadRecovery.svelte';
  import ContentBrowser from './ContentBrowser.svelte';
  import KeywordGlossary from './KeywordGlossary.svelte';

  const app = useAppState();

  const TABS = [
    { id: 'cards', label: 'Cards' },
    { id: 'packs', label: 'Packs' },
    { id: 'keywords', label: 'Keywords' },
  ];

  let packs = $state<PackInfo[]>([]);
  // Open on Packs when something needs fixing.
  let tab = $state(app.loadErrors.length > 0 ? 'packs' : 'cards');

  async function refresh() {
    if (app.status === 'ready') packs = await app.ctx.library.list();
  }

  $effect(() => {
    void app.snapshot;
    void refresh();
  });

  async function importPack(input: unknown): Promise<string[]> {
    const r = await app.ctx.library.import(input);
    if (!r.ok) return r.error.map(formatLoadError);
    toasts.push(`Pack “${r.value.id}” ${r.value.replaced ? 'updated' : 'imported'}`, 'ok');
    await refresh();
    return [];
  }
</script>

<Page title="Library" purpose="Manage card and campaign packs, browse unit and force cards, and look up keywords.">
  {#if app.status === 'loading'}
    <p class="muted">Loading packs…</p>
  {:else if app.status === 'ready'}
    {#if app.snapshot && app.snapshot.errors.length > 0}
      <LoadRecovery errors={app.snapshot.errors} {packs} {refresh} />
    {/if}

    <Tabs label="Library sections" tabs={TABS} bind:selected={tab}>
      {#snippet panel(id)}
        {#if id === 'packs'}
          <div class="stack">
            <Panel title="Import a pack" level={2}>
              <p class="muted lead">Packs are JSON files. Importing a pack with an id you already have replaces it.</p>
              <JsonImport noun="pack" onimport={importPack} />
            </Panel>
            <PackList {packs} {refresh} />
          </div>
        {:else if id === 'keywords'}
          <KeywordGlossary />
        {:else}
          <ContentBrowser />
        {/if}
      {/snippet}
    </Tabs>
  {/if}
</Page>

<style>
  .muted {
    color: var(--c-text-muted);
  }
  .lead {
    margin-bottom: var(--sp-3);
  }
</style>
