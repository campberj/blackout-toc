<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
</script>

<Page title="Unit Forge" purpose="Build custom units and check them against the active ruleset's limits.">
  <EmptyState title="Nothing forged yet" message="Custom units you create will be listed here and usable in any roster." icon="forge" />
</Page>
