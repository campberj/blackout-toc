<script lang="ts">
  import { toCardViewModel, toForceCardViewModel, type CardContext } from '../../../app';
  import type { CardVariant } from '$lib/app/view-models/card-view-model';
  import { useAppState } from '../../state/app-context.svelte';
  import { href } from '../../router.svelte';
  import CardView from '../../components/card/CardView.svelte';
  import ForceCardView from '../../components/card/ForceCardView.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import FilterChips from '../../components/FilterChips.svelte';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import LinkButton from '../../components/LinkButton.svelte';
  import { emptyFilter, factionOptions, filterForces, filterUnits, groupByFaction, typeOptions, type CardFilter } from './library-model';

  const app = useAppState();

  let filter = $state<CardFilter>(emptyFilter());
  let size = $state<CardVariant>('compact');

  const reg = $derived(app.registry);
  const cardCtx = $derived<CardContext | null>(reg ? { lookup: reg, rulesetId: app.activeRulesetId } : null);
  const allUnits = $derived(reg?.list('unit') ?? []);
  const allForces = $derived(reg?.list('force') ?? []);
  const units = $derived(reg ? groupByFaction(filterUnits(allUnits, filter), reg) : []);
  const forces = $derived(reg ? groupByFaction(filterForces(allForces, filter), reg) : []);
  const shown = $derived(units.reduce((n, g) => n + g.items.length, 0) + forces.reduce((n, g) => n + g.items.length, 0));
</script>

{#if !reg || !cardCtx || allUnits.length + allForces.length === 0}
  <EmptyState
    icon="library"
    title="No unit or force cards loaded"
    message="This app ships no official card data. Players type their own cards into a pack with id “blkout”, using each card’s printed code as its id (blkout:tfb-9861), so packs typed by different people still line up. Import that pack on the Packs tab, or forge your own units."
  >
    {#snippet action()}
      <LinkButton variant="primary" href={href('/forge')}><Icon name="forge" size={18} />Open the Forge</LinkButton>
    {/snippet}
  </EmptyState>
{:else}
  <div class="browser">
    <div class="filters no-print">
      <Field label="Search cards" hint="Name, card code or weapon">
        {#snippet control(a)}
          <input class="control" type="search" {...a} bind:value={filter.query} />
        {/snippet}
      </Field>
      <div class="chip-row">
        <span class="chip-label">Faction</span>
        <FilterChips label="Filter by faction" options={factionOptions(reg)} selected={filter.factions} onchange={(v) => (filter.factions = v)} />
      </div>
      <div class="chip-row">
        <span class="chip-label">Type</span>
        <FilterChips label="Filter by unit type" options={typeOptions(allUnits)} selected={filter.types} onchange={(v) => (filter.types = v)} />
      </div>
      <div class="bar">
        <p class="count" aria-live="polite">{shown} card{shown === 1 ? '' : 's'}</p>
        <div class="cluster">
          <Button variant="ghost" aria-pressed={size === 'full'} onclick={() => (size = size === 'full' ? 'compact' : 'full')}>
            {size === 'full' ? 'Compact cards' : 'Full cards'}
          </Button>
          <Button onclick={() => window.print()}><Icon name="print" size={18} />Print shown</Button>
        </div>
      </div>
    </div>

    {#if shown === 0}
      <EmptyState icon="search" title="No cards match" message="Clear the search or turn off a filter chip." />
    {/if}

    <div class="no-print groups">
      {#each forces as g (g.faction)}
        <section aria-label="{g.name} force cards">
          <h3 class="group-h">{g.name} <span class="sub">force cards</span></h3>
          <div class="grid" class:compact={size === 'compact'}>
            {#each g.items as f (f.id)}<ForceCardView card={toForceCardViewModel(f, cardCtx)} variant={size} />{/each}
          </div>
        </section>
      {/each}
      {#each units as g (g.faction)}
        <section aria-label="{g.name} units">
          <h3 class="group-h">{g.name} <span class="sub">units</span></h3>
          <div class="grid" class:compact={size === 'compact'}>
            {#each g.items as u (u.id)}<CardView card={toCardViewModel(u, cardCtx)} variant={size} />{/each}
          </div>
        </section>
      {/each}
    </div>

    <!-- Paper always gets the print variant of whatever the filters show. -->
    <div class="print-only print-card-grid">
      {#each forces as g (g.faction)}{#each g.items as f (f.id)}<ForceCardView card={toForceCardViewModel(f, cardCtx)} variant="print" />{/each}{/each}
      {#each units as g (g.faction)}{#each g.items as u (u.id)}<CardView card={toCardViewModel(u, cardCtx)} variant="print" />{/each}{/each}
    </div>
  </div>
{/if}

<style>
  .browser,
  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .filters {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .filters :global(.field) {
    max-width: 28rem;
  }
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
  }
  .chip-label {
    min-width: 4.5rem;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding-top: var(--sp-2);
    border-top: 1px solid var(--c-border);
  }
  .count {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .group-h {
    margin-bottom: var(--sp-3);
    padding-bottom: var(--sp-1);
    border-bottom: 1px solid var(--c-border);
    font-size: var(--fs-lg);
  }
  .sub {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-regular);
  }
  .grid {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 21rem), 1fr));
    align-items: start;
  }
  .grid.compact {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  }
</style>
