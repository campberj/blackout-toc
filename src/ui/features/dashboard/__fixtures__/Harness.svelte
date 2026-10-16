<script lang="ts">
  // Test-only: app root context + the dashboard page.
  import type { AppContext } from '$lib/app';
  import { provideAppState } from '../../../state/app-context.svelte';
  import DashboardPage from '../DashboardPage.svelte';

  let { boot }: { boot: () => Promise<AppContext> } = $props();
  // svelte-ignore state_referenced_locally
  provideAppState(boot);
</script>

<DashboardPage />
