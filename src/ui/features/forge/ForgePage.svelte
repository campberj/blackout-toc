<script lang="ts">
  import { toCardViewModel, USER_PACK_ID } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import { saveJsonText } from '../../state/files';
  import { href, router } from '../../router.svelte';
  import Page from '../../shell/Page.svelte';
  import Button from '../../components/Button.svelte';
  import CardView from '../../components/card/CardView.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LinkButton from '../../components/LinkButton.svelte';
  import UnitEditor from './UnitEditor.svelte';
  import { blankForm, localId, unitToForm } from './forge-form';

  const app = useAppState();

  const id = $derived(router.query.id);
  const units = $derived.by(() => {
    void app.snapshot;
    return app.status === 'ready' ? [...app.ctx.customUnits.list()].sort((a, b) => a.name.localeCompare(b.name)) : [];
  });
  const editing = $derived(id && id !== 'new' ? units.find((u) => localId(u.id) === id) : undefined);
  const firstFaction = $derived(app.registry?.list('faction')[0]?.id ?? '');
  const userPackOff = $derived(app.status === 'ready' && !app.snapshot?.versions[USER_PACK_ID]);

  async function exportPack() {
    saveJsonText('my-units', await app.ctx.customUnits.exportPack());
  }
</script>

<Page title="Unit Forge" purpose="Build custom units and check them against the active ruleset’s limits and calibration.">
  {#snippet actions()}
    {#if id}
      <LinkButton variant="ghost" href={href('/forge')}>All custom units</LinkButton>
    {:else}
      {#if units.length > 0}<Button variant="ghost" onclick={exportPack}><Icon name="download" size={18} />Export my units</Button>{/if}
      <LinkButton variant="primary" href={href('/forge', { id: 'new' })}><Icon name="plus" size={18} />New unit</LinkButton>
    {/if}
  {/snippet}

  {#if app.status !== 'ready' || !app.registry}
    <p class="muted">Loading…</p>
  {:else if id === 'new'}
    {#key id}<UnitEditor initial={blankForm(firstFaction)} />{/key}
  {:else if id}
    {#if editing}
      {#key editing.id}<UnitEditor initial={unitToForm(editing)} editingId={editing.id} />{/key}
    {:else}
      <EmptyState icon="forge" title="Unit not found" message={userPackOff ? 'Your units pack is disabled. Enable “My Units” in the Library to edit it.' : 'It may have been deleted.'}>
        {#snippet action()}<LinkButton href={href('/forge')}>Back to custom units</LinkButton>{/snippet}
      </EmptyState>
    {/if}
  {:else if units.length === 0}
    <EmptyState
      icon="forge"
      title="Nothing forged yet"
      message="Custom units are saved to your own pack (user:…) and can be used in any roster. Each one is checked against the active ruleset’s hard limits; style warnings never block saving."
    >
      {#snippet action()}<LinkButton variant="primary" href={href('/forge', { id: 'new' })}><Icon name="plus" size={18} />Forge a unit</LinkButton>{/snippet}
    </EmptyState>
  {:else}
    <ul class="grid" role="list">
      {#each units as u (u.id)}
        <li class="cell">
          <CardView card={toCardViewModel(u, { lookup: app.registry, rulesetId: app.activeRulesetId })} variant="compact" />
          <LinkButton href={href('/forge', { id: localId(u.id) })}><Icon name="edit" size={18} />Edit {u.name}</LinkButton>
        </li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
  .muted {
    color: var(--c-text-muted);
  }
  .grid {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
    align-items: start;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
</style>
