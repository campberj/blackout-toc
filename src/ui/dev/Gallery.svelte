<script lang="ts">
  // Dev-only component gallery (#/dev/gallery). Excluded from prod by the router + dynamic import.
  import Page from '../shell/Page.svelte';
  import Button from '../components/Button.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Panel from '../components/Panel.svelte';
  import Stat from '../components/Stat.svelte';
  import PipTrack from '../components/PipTrack.svelte';
  import Counter from '../components/Counter.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import Tag from '../components/Tag.svelte';
  import Tabs from '../components/Tabs.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Field from '../components/Field.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import CardView from '../components/card/CardView.svelte';
  import { toasts } from '../components/toast.svelte';
  import { DEMO_HANDLER, DEMO_RECON } from '../components/card/demo-cards';
  import { emptyTrackerState } from '../components/card/card-view-model';
  import { theme } from '../theme';

  let cp = $state(2);
  let damage = $state(1);
  let round = $state(1);
  let vp = $state(0);
  let dialogOpen = $state(false);
  let tab = $state('a');
  let callsign = $state('');
  let recon = $state(emptyTrackerState(DEMO_RECON));
  let handler = $state(emptyTrackerState(DEMO_HANDLER));
</script>

<Page title="Component gallery" purpose="Every design-system component in one place, for review. Dev builds only.">
  {#snippet actions()}
    <Button onclick={() => theme.set(theme.choice === 'light' ? 'dark' : 'light')}>Toggle theme</Button>
  {/snippet}

  <div class="panel-grid">
    <Panel title="Buttons">
      <div class="cluster">
        <Button variant="primary">Start game</Button>
        <Button>Save roster</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Delete</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div class="cluster gap">
        <Button variant="primary" size="lg">Next round</Button>
        <IconButton icon="plus" label="Add unit" variant="secondary" />
        <IconButton icon="print" label="Print" />
        <IconButton icon="close" label="Close" />
      </div>
    </Panel>

    <Panel title="Stats and badges">
      {#snippet actions()}<StatusBadge status="ok" label="Ready" />{/snippet}
      <dl class="stats">
        <Stat label="Round" value="3/6" size="lg" />
        <Stat label="CP" value={cp} />
        <Stat label="VP" value={vp} />
        <Stat label="Skill" value="6+" size="sm" />
      </dl>
      <div class="cluster gap">
        <StatusBadge status="ok" label="Active" />
        <StatusBadge status="warn" label="Suppressed" />
        <StatusBadge status="crit" label="Down" />
        <StatusBadge status="info" label="Tagged" />
        <StatusBadge status="neutral" label="Reserve" />
      </div>
      <div class="cluster gap">
        <Tag>Recon</Tag><Tag>Light</Tag><Tag>Custom</Tag>
      </div>
    </Panel>

    <Panel title="Pip tracks">
      <div class="stack">
        <PipTrack label="Command points" max={6} bind:value={cp} />
        <PipTrack label="Wounds" max={2} shape="box" tone="crit" bind:value={damage} />
        <PipTrack label="Combat loads" max={2} shape="box" tone="warn" />
        <PipTrack label="Read-only" max={4} value={3} tone="ok" readonly />
      </div>
    </Panel>

    <Panel title="Counters">
      <div class="cluster wide">
        <Counter label="Round" bind:value={round} min={1} max={6} />
        <Counter label="Victory points" bind:value={vp} />
      </div>
    </Panel>

    <Panel title="Fields">
      <div class="stack">
        <Field label="Callsign" hint="Shown on the roster sheet." required>
          {#snippet control(a)}<input class="control" {...a} bind:value={callsign} />{/snippet}
        </Field>
        <Field label="Mode" error={callsign ? undefined : 'Enter a callsign first.'}>
          {#snippet control(a)}
            <select class="control" {...a}>
              <option>Core</option><option>Matched</option><option>Skirmish</option>
            </select>
          {/snippet}
        </Field>
        <Field label="Notes">
          {#snippet control(a)}<textarea class="control" {...a}></textarea>{/snippet}
        </Field>
      </div>
    </Panel>

    <Panel title="Tabs, dialog, toasts">
      <Tabs label="Demo" tabs={[{ id: 'a', label: 'Brief' }, { id: 'b', label: 'Play' }, { id: 'c', label: 'Debrief' }]} bind:selected={tab}>
        {#snippet panel(id)}<p>Selected tab: <span class="mono">{id}</span></p>{/snippet}
      </Tabs>
      <div class="cluster gap">
        <Button onclick={() => (dialogOpen = true)}>Open dialog</Button>
        <Button onclick={() => toasts.push('Roster saved', 'ok')}>Toast ok</Button>
        <Button onclick={() => toasts.push('Over the CP cap', 'warn')}>Toast warn</Button>
        <Button onclick={() => toasts.push('Import failed: missing id', 'crit', 0)}>Toast crit</Button>
      </div>
    </Panel>
  </div>

  <EmptyState title="No games yet" message="Start a game from a saved roster to begin tracking." icon="dashboard">
    {#snippet action()}<Button variant="primary">Start a game</Button>{/snippet}
  </EmptyState>

  <h2>Cards, live tracking</h2>
  <div class="cards">
    <CardView card={DEMO_RECON} variant="full" bind:tracker={recon} />
    <CardView card={DEMO_HANDLER} variant="compact" bind:tracker={handler} />
    <CardView card={DEMO_HANDLER} variant="print" />
  </div>
</Page>

<Dialog bind:open={dialogOpen} title="End round 3?">
  <p>Unspent command points carry over up to the cap.</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
    <Button variant="primary" onclick={() => (dialogOpen = false)}>End round</Button>
  {/snippet}
</Dialog>

<style>
  .gap {
    margin-top: var(--sp-3);
  }
  .wide {
    gap: var(--sp-6);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-5);
  }
  .cards {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
    align-items: start;
  }
</style>
