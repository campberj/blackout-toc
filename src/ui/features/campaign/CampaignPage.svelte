<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
</script>

<Page title="Campaign" purpose="Run a solo narrative campaign: briefings, after-action reports and operator progress.">
  <EmptyState title="No campaign loaded" message="Import a campaign pack to begin your first operation." icon="campaign" />
</Page>
