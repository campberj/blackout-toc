<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
</script>

<Page title="Roster" purpose="Pick a handler and units, check the team is legal, then save, print or export it.">
  <EmptyState title="No teams yet" message="Team building arrives once card packs can be imported." icon="roster" />
</Page>
