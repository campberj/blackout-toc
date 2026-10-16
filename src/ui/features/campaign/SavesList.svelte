<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import Panel from '../../components/Panel.svelte';
  import Button from '../../components/Button.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import Field from '../../components/Field.svelte';
  import JsonImport from '../../components/JsonImport.svelte';
  import { toasts } from '../../components/toast.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import { fileStem, saveJsonText } from '../../state/files';
  import { formatLoadErrors, type CampaignSaveSummary } from '../../../app';
  import type { Id } from '$lib/packs/schema';

  const app = useAppState();
  let saves = $state<CampaignSaveSummary[] | null>(null);
  let renaming = $state<CampaignSaveSummary | null>(null);
  let renameText = $state('');
  let renameError = $state<string | undefined>();
  let deleting = $state<CampaignSaveSummary | null>(null);
  let confirmOpen = $state(false);
  let renameOpen = $state(false);

  async function refresh() {
    saves = (await app.ctx.campaigns.list()).sort((a, b) => (b.lastAt ?? b.createdAt).localeCompare(a.lastAt ?? a.createdAt));
  }
  $effect(() => {
    void refresh();
  });

  const campaignName = (id: string) => app.registry?.get('campaign', id as Id)?.name ?? null;
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const hasCampaigns = $derived((app.registry?.list('campaign').length ?? 0) > 0);

  async function exportSave(s: CampaignSaveSummary) {
    const r = await app.ctx.campaigns.exportSave(s.id);
    if (!r.ok) return toasts.push(r.error, 'crit');
    saveJsonText(`${fileStem(s.name, 'campaign')}.campaign`, r.value);
    toasts.push(`Exported ${s.name}.`, 'ok');
  }

  async function doRename() {
    if (!renaming) return;
    const r = await app.ctx.campaigns.rename(renaming.id, renameText);
    if (!r.ok) {
      renameError = r.error;
      return;
    }
    renameOpen = false;
    toasts.push(`Renamed to ${r.value.name}.`, 'ok');
    await refresh();
  }

  async function doDelete() {
    if (!deleting) return;
    const name = deleting.name;
    await app.ctx.campaigns.remove(deleting.id);
    toasts.push(`Deleted ${name}.`, 'ok');
    await refresh();
  }

  async function importSave(input: unknown): Promise<string[]> {
    const r = await app.ctx.campaigns.importSave(input);
    if (!r.ok) return [r.error];
    toasts.push(`Imported ${r.value.save.name}.`, 'ok');
    router.go('/campaign', { save: r.value.save.id });
    return [];
  }

  async function importPack(input: unknown): Promise<string[]> {
    const r = await app.ctx.library.import(input);
    if (!r.ok) return formatLoadErrors(r.error);
    const n = r.value.snapshot.packs.find((p) => p.id === r.value.id)?.content.campaigns.length ?? 0;
    toasts.push(`${r.value.replaced ? 'Updated' : 'Imported'} pack ${r.value.id}${n ? ` with ${n} campaign${n === 1 ? '' : 's'}` : ' (no campaigns in it)'}.`, n ? 'ok' : 'warn');
    return [];
  }
</script>

<Page title="Campaign" purpose="Run a solo narrative campaign: briefings, after-action reports and operator progress.">
  {#snippet actions()}
    <Button variant="primary" href={href('/campaign', { new: '1' })}>Start new campaign</Button>
  {/snippet}

  <Panel title="Saved campaigns">
    {#if saves === null}
      <p class="muted">Loading saves…</p>
    {:else if saves.length === 0}
      <EmptyState
        title="No campaigns yet"
        message={hasCampaigns ? 'Start a campaign from your loaded content, or import a save file.' : 'Import a campaign pack below, then start your first operation.'}
        icon="campaign"
      />
    {:else}
      <ul class="saves" role="list">
        {#each saves as s (s.id)}
          {@const cname = campaignName(s.campaignId)}
          <li class="save">
            <div class="info">
              <a class="name" href={href('/campaign', { save: s.id })}>{s.name}</a>
              <p class="meta">
                {#if cname}{cname}{:else}<span class="warn">Campaign pack not loaded ({s.campaignId})</span>{/if}
              </p>
              <p class="meta mono">Last activity {when(s.lastAt)}, {s.events} log entries</p>
            </div>
            <div class="acts">
              <Button variant="primary" href={href('/campaign', { save: s.id })}>Continue</Button>
              <IconButton icon="edit" label="Rename {s.name}" onclick={() => { renaming = s; renameText = s.name; renameError = undefined; renameOpen = true; }} />
              <IconButton icon="download" label="Export {s.name}" onclick={() => exportSave(s)} />
              <IconButton icon="trash" label="Delete {s.name}" onclick={() => { deleting = s; confirmOpen = true; }} />
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>

  <div class="panel-grid">
    <Panel title="Import a save">
      <p class="muted lead">Restore a campaign exported from this app (the file keeps its full history).</p>
      <JsonImport noun="save" onimport={importSave} />
    </Panel>
    <Panel title="Import a campaign pack">
      <p class="muted lead">Adds the pack to your <a href={href('/library')}>library</a>. Its campaigns appear under Start new campaign.</p>
      <JsonImport noun="pack" onimport={importPack} />
    </Panel>
  </div>
</Page>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete campaign?"
  message={`"${deleting?.name ?? ''}" and its whole history will be deleted from this device. Export it first if you may want it back.`}
  confirmLabel="Delete campaign"
  onconfirm={doDelete}
/>

<Dialog bind:open={renameOpen} title="Rename campaign">
  <form id="rename-form" onsubmit={(e) => { e.preventDefault(); void doRename(); }}>
    <Field label="Name" required error={renameError}>
      {#snippet control(a)}<input class="control" {...a} bind:value={renameText} maxlength="80" />{/snippet}
    </Field>
  </form>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (renameOpen = false)}>Cancel</Button>
    <Button variant="primary" type="submit" form="rename-form">Save name</Button>
  {/snippet}
</Dialog>

<style>
  .muted {
    color: var(--c-text-muted);
  }
  .lead {
    margin-bottom: var(--sp-3);
    font-size: var(--fs-sm);
  }
  .saves {
    display: flex;
    flex-direction: column;
  }
  .save {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px solid var(--c-border);
  }
  .save:first-child {
    padding-top: 0;
  }
  .save:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .info {
    min-width: 0;
  }
  .name {
    color: var(--c-text);
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    text-decoration: none;
  }
  .name:hover {
    text-decoration: underline;
  }
  .meta {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .meta.mono {
    font-size: var(--fs-xs);
  }
  .warn {
    color: var(--c-warn);
  }
  .acts {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
  }
</style>
