<script lang="ts">
  import { useAppState } from '../../state/app-context.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Tag from '../../components/Tag.svelte';
  import { glossary } from './library-model';

  const app = useAppState();
  let query = $state('');
  const rows = $derived(app.registry ? glossary(app.registry, app.activeRulesetId, query) : []);
  const rulesetName = $derived(app.activeRulesetId ? (app.registry?.get('ruleset', app.activeRulesetId)?.name ?? app.activeRulesetId) : null);
</script>

<div class="stack">
  <p class="ctx">
    {#if rulesetName}Showing text for <strong>{rulesetName}</strong>. Change the ruleset in Settings.{:else}No ruleset loaded; showing each keyword’s short summary.{/if}
  </p>
  <Field label="Search keywords">
    {#snippet control(a)}<input class="control" type="search" {...a} bind:value={query} />{/snippet}
  </Field>
  {#if rows.length === 0}
    <EmptyState icon="search" title={query ? 'No keywords match' : 'No keywords loaded'} message={query ? 'Try a shorter search.' : 'Keywords come from imported packs.'} />
  {:else}
    <dl class="gloss">
      {#each rows as k (k.id)}
        <div class="row">
          <dt>
            <span class="name">{k.name}{k.param ? ' (X)' : ''}</span>
            <Tag>{k.appliesTo}</Tag>
            {#if !k.rulesetText}<Tag>summary</Tag>{/if}
          </dt>
          <dd>{k.text}</dd>
          <dd class="id mono">{k.id}</dd>
        </div>
      {/each}
    </dl>
  {/if}
</div>

<style>
  .ctx {
    color: var(--c-text-muted);
  }
  .stack :global(.field) {
    max-width: 28rem;
  }
  .gloss {
    display: grid;
    gap: 0;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
    column-gap: var(--sp-5);
  }
  .row {
    padding: var(--sp-3) 0;
    border-top: 1px solid var(--c-border);
  }
  dt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .name {
    font-weight: var(--fw-bold);
  }
  dd {
    margin: var(--sp-1) 0 0;
    max-width: var(--measure);
  }
  .id {
    color: var(--c-text-faint);
    font-size: var(--fs-xs);
  }
</style>
