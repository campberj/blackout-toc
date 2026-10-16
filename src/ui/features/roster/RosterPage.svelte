<script lang="ts">
  import { formatIssue, type Roster } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import { href, router } from '../../router.svelte';
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import JsonImport from '../../components/JsonImport.svelte';
  import LinkButton from '../../components/LinkButton.svelte';
  import Panel from '../../components/Panel.svelte';
  import { toasts } from '../../components/toast.svelte';
  import RosterEditor from './RosterEditor.svelte';
  import RosterList from './RosterList.svelte';
  import { blankRoster } from './roster-form';

  const app = useAppState();

  let rosters = $state<Roster[]>([]);
  let loaded = $state(false);
  const id = $derived(router.query.id);
  const editing = $derived(id === 'new' || !id ? undefined : rosters.find((r) => r.id === id));

  async function refresh() {
    if (app.status !== 'ready') return;
    rosters = (await app.ctx.rosters.list()).sort((a, b) => a.name.localeCompare(b.name));
    loaded = true;
  }

  $effect(() => {
    void app.status;
    void id; // re-read after save/duplicate navigates
    void refresh();
  });

  async function importRoster(input: unknown): Promise<string[]> {
    const r = await app.ctx.rosters.importRoster(input);
    if (!r.ok) return r.error.map(formatIssue);
    toasts.push(`Imported “${r.value.roster.name}”`, 'ok');
    await refresh();
    return [];
  }
</script>

<Page title="Roster" purpose="Pick force cards, handlers and units, check the team is legal, then save, print or export it.">
  {#snippet actions()}
    {#if id}
      <LinkButton variant="ghost" href={href('/roster')}>All rosters</LinkButton>
    {:else if app.activeRulesetId}
      <LinkButton variant="primary" href={href('/roster', { id: 'new' })}><Icon name="plus" size={18} />New roster</LinkButton>
    {/if}
  {/snippet}

  {#if app.status !== 'ready' || !loaded}
    <p class="muted">Loading…</p>
  {:else if id === 'new'}
    {#if app.activeRulesetId && app.registry}
      {#key id}
        <RosterEditor initial={blankRoster(app.registry, app.activeRulesetId)} isNew names={rosters.map((r) => r.name)} />
      {/key}
    {:else}
      <EmptyState icon="library" title="No ruleset loaded" message="Rosters are checked against a ruleset’s team rules. Import or enable a pack that provides one.">
        {#snippet action()}<LinkButton variant="primary" href={href('/library')}>Open the Library</LinkButton>{/snippet}
      </EmptyState>
    {/if}
  {:else if id}
    {#if editing}
      {#key editing.id}
        <RosterEditor initial={editing} isNew={false} names={rosters.map((r) => r.name)} />
      {/key}
    {:else}
      <EmptyState icon="roster" title="Roster not found" message="It may have been deleted on this device.">
        {#snippet action()}<LinkButton href={href('/roster')}>Back to rosters</LinkButton>{/snippet}
      </EmptyState>
    {/if}
  {:else}
    <div class="stack">
      {#if rosters.length === 0}
        <EmptyState
          icon="roster"
          title="No rosters yet"
          message={app.activeRulesetId ? 'Start a roster, or import one exported from another device.' : 'Load a pack with a ruleset in the Library first; rosters are checked against its team rules.'}
        >
          {#snippet action()}
            {#if app.activeRulesetId}
              <LinkButton variant="primary" href={href('/roster', { id: 'new' })}><Icon name="plus" size={18} />New roster</LinkButton>
            {:else}
              <LinkButton variant="primary" href={href('/library')}>Open the Library</LinkButton>
            {/if}
          {/snippet}
        </EmptyState>
      {:else}
        <RosterList {rosters} {refresh} />
      {/if}
      <Panel title="Import a roster">
        <JsonImport noun="roster" onimport={importRoster} />
      </Panel>
    </div>
  {/if}
</Page>

<style>
  .muted {
    color: var(--c-text-muted);
  }
</style>
