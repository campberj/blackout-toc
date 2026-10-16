<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import SavesList from './SavesList.svelte';
  import NewCampaignWizard from './NewCampaignWizard.svelte';
  import CampaignShell from './CampaignShell.svelte';

  // #/campaign → saves · ?new=1 → wizard · ?save=<id>[&brief|aar|debrief|view] → open save.
  const app = useAppState();
  const save = $derived(router.query['save']);
</script>

{#if app.status !== 'ready'}
  <Page title="Campaign" purpose="Run a solo narrative campaign: briefings, after-action reports and operator progress.">
    <EmptyState title={app.status === 'failed' ? 'App failed to start' : 'Loading…'} icon="campaign" />
  </Page>
{:else if save}
  {#key save}
    <CampaignShell saveId={save} />
  {/key}
{:else if router.query['new']}
  <NewCampaignWizard />
{:else}
  <SavesList />
{/if}
