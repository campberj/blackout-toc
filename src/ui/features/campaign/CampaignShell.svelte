<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Button from '../../components/Button.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import { CampaignSession } from './session.svelte';
  import DriftBanner from './DriftBanner.svelte';
  import OpsCenter from './OpsCenter.svelte';
  import BriefingScreen from './BriefingScreen.svelte';
  import AarScreen from './AarScreen.svelte';
  import DebriefScreen from './DebriefScreen.svelte';
  import RosterScreen from './RosterScreen.svelte';

  // Loads one save; sub-views (ops / brief / aar / debrief / roster) share the session.
  interface Props {
    saveId: string;
  }
  let { saveId }: Props = $props();

  const app = useAppState();
  // svelte-ignore state_referenced_locally (keyed by saveId in the parent)
  const session = new CampaignSession(app.ctx.campaigns, saveId, () => app.registry);

  // Reload on pack changes (engine cache invalidates on registry change).
  $effect(() => {
    void app.snapshot;
    void session.load();
  });

  const q = $derived(router.query);
  const view = $derived(q['aar'] ? 'aar' : q['brief'] ? 'brief' : q['debrief'] ? 'debrief' : q['view'] === 'roster' ? 'roster' : 'ops');
  const tabs = [
    { id: 'ops', label: 'Operations' },
    { id: 'roster', label: 'Roster' },
  ] as const;
</script>

{#if session.loading && !session.open}
  <Page title="Campaign" purpose="Loading save…"><p class="muted">Loading…</p></Page>
{:else if session.error && !session.open}
  <Page title="Campaign" purpose="This save could not be opened.">
    <EmptyState title="Save unavailable" message={session.error} icon="alert">
      {#snippet action()}<Button href={href('/campaign')}>Back to saves</Button>{/snippet}
    </EmptyState>
  </Page>
{:else if session.open && !session.campaign}
  <Page title={session.open.save.name} purpose="Campaign pack not loaded.">
    <EmptyState title="Campaign pack missing" message={`This save needs ${session.open.save.campaignId}. Import or enable its pack in the Library.`} icon="library">
      {#snippet action()}<Button href={href('/library')}>Open Library</Button>{/snippet}
    </EmptyState>
  </Page>
{:else if session.open && session.campaign}
  <Page title={session.open.save.name} purpose={session.state?.status === 'complete' ? `${session.campaign.name}. Campaign complete.` : session.campaign.name}>
    {#snippet actions()}
      <Button variant="ghost" href={href('/campaign')}>All saves</Button>
    {/snippet}
    {#if session.open.drift.length}<DriftBanner drift={session.open.drift} />{/if}
    {#if view === 'ops' || view === 'roster'}
      <nav class="subnav" aria-label="Campaign sections">
        {#each tabs as t (t.id)}
          <a href={href('/campaign', t.id === 'ops' ? { save: saveId } : { save: saveId, view: t.id })} aria-current={view === t.id ? 'page' : undefined}>{t.label}</a>
        {/each}
      </nav>
    {/if}
    {#if view === 'aar'}
      {#key q['aar']}<AarScreen {session} mission={q['aar']!} selected={q['ops']?.split(',').filter(Boolean) ?? []} />{/key}
    {:else if view === 'brief'}
      {#key q['brief']}<BriefingScreen {session} mission={q['brief']!} />{/key}
    {:else if view === 'debrief'}
      <DebriefScreen {session} from={Number(q['debrief']) || 1} mission={q['mission']} />
    {:else if view === 'roster'}
      <RosterScreen {session} />
    {:else}
      <OpsCenter {session} />
    {/if}
  </Page>
{/if}

<style>
  .muted {
    color: var(--c-text-muted);
  }
  .subnav {
    display: flex;
    gap: var(--sp-1);
    margin-top: calc(-1 * var(--sp-2));
    border-bottom: 1px solid var(--c-border);
  }
  .subnav a {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 var(--sp-4);
    color: var(--c-text-muted);
    font-weight: var(--fw-medium);
    text-decoration: none;
  }
  .subnav a:hover {
    color: var(--c-text);
  }
  .subnav a[aria-current='page'] {
    color: var(--c-text);
  }
  .subnav a[aria-current='page']::after {
    content: '';
    position: absolute;
    inset: auto var(--sp-2) -1px;
    height: 3px;
    background: var(--c-accent);
  }
</style>
