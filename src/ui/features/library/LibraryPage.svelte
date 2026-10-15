<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import Tabs from '../../components/Tabs.svelte';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import CardView from '../../components/card/CardView.svelte';
  import { DEMO_CARDS } from '../../components/card/demo-cards';
  import type { CardVariant } from '../../components/card/card-view-model';

  const VIEWS = [
    { id: 'full', label: 'Full' },
    { id: 'compact', label: 'Compact' },
    { id: 'print', label: 'Print' },
  ] as const;

  let view = $state<string>('full');
  const variant = $derived(view as CardVariant);
</script>

<Page title="Library" purpose="Browse every unit and force card from your imported packs.">
  {#snippet actions()}
    <Button onclick={() => window.print()}><Icon name="print" size={18} />Print cards</Button>
  {/snippet}

  <p class="note no-print">Demo cards below are invented placeholders for layout review, not game content.</p>

  <div class="no-print">
    <Tabs label="Card view" tabs={VIEWS} bind:selected={view}>
      {#snippet panel()}
        <div class="grid" class:compact={variant === 'compact'}>
          {#each DEMO_CARDS as card (card.id)}
            <CardView {card} {variant} />
          {/each}
        </div>
      {/snippet}
    </Tabs>
  </div>

  <!-- Paper always gets the print variant, whatever view is on screen. -->
  <div class="print-only print-card-grid">
    {#each DEMO_CARDS as card (card.id)}
      <CardView {card} variant="print" />
    {/each}
  </div>
</Page>

<style>
  .note {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
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
