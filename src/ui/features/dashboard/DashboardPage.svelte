<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
</script>

<Page title="Game" purpose="Track the round, command points, objectives and every unit's status during play.">
  <EmptyState title="No game in progress" message="Start a game from a saved roster to open the tracker." icon="dashboard" />
</Page>
