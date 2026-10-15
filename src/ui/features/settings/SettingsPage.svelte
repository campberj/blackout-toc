<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import Panel from '../../components/Panel.svelte';
  import Field from '../../components/Field.svelte';
  import { theme, type ThemeChoice } from '../../theme';

  const OPTIONS: { value: ThemeChoice; label: string }[] = [
    { value: 'dark', label: 'Dark (low glare)' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'Match device' },
  ];
</script>

<Page title="Settings" purpose="Choose display, ruleset and content-filter preferences for this device.">
  <div class="panel-grid">
    <Panel title="Display">
      <Field label="Theme" hint="Printing always uses the light theme.">
        {#snippet control(a)}
          <select class="control" {...a} value={theme.choice} onchange={(e) => theme.set(e.currentTarget.value as ThemeChoice)}>
            {#each OPTIONS as o (o.value)}
              <option value={o.value}>{o.label}</option>
            {/each}
          </select>
        {/snippet}
      </Field>
    </Panel>
  </div>
</Page>
