<script lang="ts">
  import { DEFAULT_RULESET_SUFFIX } from '../../../app';
  import type { Id } from '$lib/packs/schema';
  import Page from '../../shell/Page.svelte';
  import Panel from '../../components/Panel.svelte';
  import Field from '../../components/Field.svelte';
  import Button from '../../components/Button.svelte';
  import FilterChips from '../../components/FilterChips.svelte';
  import Icon from '../../components/Icon.svelte';
  import LinkButton from '../../components/LinkButton.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import { theme, type ThemeChoice } from '../../theme';
  import { href } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import { normalizeTag, tagOptions } from './settings-model';
  import BackupPanel from './BackupPanel.svelte';

  const app = useAppState();

  const OPTIONS: { value: ThemeChoice; label: string }[] = [
    { value: 'dark', label: 'Dark (low glare)' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'Match device' },
  ];

  const rulesets = $derived(app.registry?.list('ruleset') ?? []);
  const excluded = $derived(app.settings?.excludedTags ?? []);
  const tags = $derived(tagOptions(app.snapshot?.packs ?? [], excluded));
  const defaultName = $derived.by(() => {
    // What "Default" resolves to with no explicit choice.
    const auto = rulesets.find((r) => r.id.endsWith(DEFAULT_RULESET_SUFFIX)) ?? rulesets[0];
    return auto?.name;
  });
  let newTag = $state('');

  const setRuleset = (v: string) => app.ctx.settings.setActiveRuleset(v ? (v as Id) : null);
  const setTags = (next: readonly string[]) => app.ctx.settings.setExcludedTags(next);

  function addTag() {
    const t = normalizeTag(newTag);
    if (t) void setTags([...excluded, t]);
    newTag = '';
  }
</script>

<Page title="Settings" purpose="Choose the ruleset, content filters and display for this device.">
  <div class="panel-grid">
    <Panel title="Rules">
      {#if app.status === 'ready'}
        <Field
          label="Active ruleset"
          hint="Sets keyword text, Forge limits and the default for new rosters. Existing rosters keep their own ruleset."
        >
          {#snippet control(a)}
            <select class="control" {...a} value={app.settings?.activeRulesetId ?? ''} onchange={(e) => setRuleset(e.currentTarget.value)}>
              <option value="">Default{defaultName ? ` (${defaultName})` : ''}</option>
              {#each rulesets as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
            </select>
          {/snippet}
        </Field>
        {#if rulesets.length === 0}
          <p class="note">No ruleset is loaded. <a href={href('/library')}>Import a pack</a> that provides one.</p>
        {:else if app.settings?.activeRulesetId && !rulesets.some((r) => r.id === app.settings?.activeRulesetId)}
          <p class="note warn">Your chosen ruleset “{app.settings.activeRulesetId}” is not loaded, so the default is used.</p>
        {/if}
      {/if}
    </Panel>

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

    <Panel title="Content filter">
      <p class="note">Campaign table entries and narrative blocks with a selected tag are skipped. Tap a tag to exclude it.</p>
      {#if app.status === 'ready'}
        {#if tags.length > 0}
          <FilterChips label="Excluded content tags" mode="exclude" options={tags} selected={excluded} onchange={setTags} />
        {:else}
          <p class="note">Loaded packs don’t tag any content yet.</p>
        {/if}
        <form
          class="add"
          onsubmit={(e) => {
            e.preventDefault();
            addTag();
          }}
        >
          <Field label="Exclude another tag" hint="For tags from packs you haven’t imported yet">
            {#snippet control(a)}<input class="control" {...a} bind:value={newTag} placeholder="e.g. gore" />{/snippet}
          </Field>
          <Button type="submit" disabled={!normalizeTag(newTag)}>Exclude</Button>
        </form>
      {/if}
    </Panel>

    <Panel title="Data on this device">
      {#if app.status === 'ready'}
        <div class="cluster gap">
          {#if app.isPersistent}
            <StatusBadge status="ok" label="Saved in browser storage" />
          {:else}
            <StatusBadge status="crit" label="Not saved" />
          {/if}
        </div>
        {#if !app.isPersistent}
          <p class="note warn">
            <Icon name="alert" size={16} />Browser storage is unavailable (private browsing?). Everything you do is lost when this tab closes. Export a backup before leaving.
          </p>
        {:else}
          <p class="note">Data stays in this browser only. Clearing site data deletes it, so export a backup now and then.</p>
        {/if}
      {/if}
    </Panel>

    <Panel title="Full backup">
      {#if app.status === 'ready'}
        {#if app.ctx.backup}
          <BackupPanel backup={app.ctx.backup} />
        {:else}
          <p class="note">Full backup isn’t available in this build. Export rosters, custom units and packs from their own pages instead.</p>
          <div class="cluster gap">
            <LinkButton href={href('/roster')}>Rosters</LinkButton>
            <LinkButton href={href('/forge')}>Custom units</LinkButton>
            <LinkButton href={href('/library')}>Packs</LinkButton>
          </div>
        {/if}
      {/if}
    </Panel>
  </div>
</Page>

<style>
  .note {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    margin-top: var(--sp-2);
  }
  .warn {
    display: flex;
    gap: var(--sp-2);
    align-items: flex-start;
    color: var(--c-warn);
  }
  .gap {
    margin-top: var(--sp-3);
  }
  .add {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
  }
  .add > :global(.btn) {
    margin-top: 1.6rem;
  }
</style>
