<script lang="ts">
  import { useAppState } from '../../state/app-context.svelte';
  import { readJsonFile, saveJsonText } from '../../state/files';
  import { toasts } from '../../components/toast.svelte';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import Icon from '../../components/Icon.svelte';
  import { backupFilename, describeCounts, MODE_HELP, previewBackup, summaryText, type BackupPreview, type BackupService, type ImportMode } from './backup-model';

  /* Full backup: export everything, or restore a backup file (merge or replace) after confirmation. */
  interface Props {
    backup: BackupService;
  }

  let { backup }: Props = $props();
  const app = useAppState();
  const uid = $props.id();

  let fileInput: HTMLInputElement | undefined = $state();
  // raw: the parsed file goes to storage; a deep $state proxy cannot be structured-cloned (IndexedDB DataCloneError).
  let pending = $state.raw<{ file: unknown; preview: BackupPreview } | null>(null);
  let confirmOpen = $state(false);
  let mode = $state<ImportMode>('merge');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let result = $state<string | null>(null);

  async function exportAll() {
    error = null;
    try {
      saveJsonText(backupFilename(new Date()), JSON.stringify(await backup.exportAll()));
      toasts.push('Backup exported', 'ok');
    } catch (e) {
      error = `Export failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function pick(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    error = null;
    result = null;
    try {
      const file = await readJsonFile(f);
      const preview = previewBackup(file);
      if (!preview) {
        error = 'This file is not a BLKOUT: TOC backup. Packs and rosters are imported from the Library and Roster pages.';
        return;
      }
      pending = { file, preview };
      mode = 'merge';
      confirmOpen = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function restore() {
    if (!pending) return;
    confirmOpen = false;
    busy = true;
    try {
      const summary = await backup.importAll(pending.file, mode);
      // Storage changed underneath the services: reload packs, then settings (re-save emits to the UI).
      await app.ctx.library.rebuild();
      const s = await app.ctx.settings.load();
      await app.ctx.settings.setActiveRuleset(s.activeRulesetId);
      result = summaryText(summary);
      toasts.push('Backup restored', 'ok');
    } catch (e) {
      error = `Restore failed, nothing was changed. ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      busy = false;
      pending = null;
    }
  }

  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };
</script>

<p class="note">One file with every roster, campaign, game, imported pack, custom unit and setting on this device.</p>
<div class="cluster gap">
  <Button onclick={exportAll}><Icon name="download" size={18} />Export backup</Button>
  <input bind:this={fileInput} class="sr-only" type="file" accept=".json,application/json" aria-label="Backup file" onchange={pick} />
  <Button disabled={busy} onclick={() => fileInput?.click()}><Icon name="upload" size={18} />{busy ? 'Restoring…' : 'Restore backup'}</Button>
</div>
{#if error}<p class="msg crit" role="alert"><Icon name="alert" size={16} />{error}</p>{/if}
{#if result}<p class="msg ok" role="status"><Icon name="check" size={16} />{result}</p>{/if}

<Dialog bind:open={confirmOpen} title="Restore backup?">
  {#if pending}
    <p>Backup from {when(pending.preview.exportedAt)}: {describeCounts(pending.preview.counts).join(', ') || 'no records'}.</p>
    <fieldset class="modes">
      <legend class="sr-only">How to restore</legend>
      {#each ['merge', 'replace'] as const as m (m)}
        <label class="mode" class:on={mode === m} for="{uid}-{m}">
          <input id="{uid}-{m}" type="radio" name="{uid}-mode" value={m} bind:group={mode} />
          <span>
            <strong>{m === 'merge' ? 'Merge with this device' : 'Replace everything'}</strong>
            <span class="help">{MODE_HELP[m]}</span>
          </span>
        </label>
      {/each}
    </fieldset>
  {/if}
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (confirmOpen = false)}>Cancel</Button>
    <Button variant={mode === 'replace' ? 'danger' : 'primary'} onclick={restore}>{mode === 'replace' ? 'Replace all data' : 'Merge backup'}</Button>
  {/snippet}
</Dialog>

<style>
  .note {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .gap {
    margin-top: var(--sp-3);
  }
  .msg {
    display: flex;
    gap: var(--sp-2);
    align-items: flex-start;
    margin-top: var(--sp-3);
    font-size: var(--fs-sm);
  }
  .crit {
    color: var(--c-crit);
  }
  .ok {
    color: var(--c-ok);
  }
  .modes {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    margin: var(--sp-4) 0 0;
    padding: 0;
    border: 0;
  }
  .mode {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-3);
    align-items: start;
    min-height: var(--touch);
    padding: var(--sp-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    cursor: pointer;
  }
  .mode.on {
    border-color: var(--c-accent);
    background: color-mix(in srgb, var(--c-accent) 10%, transparent);
  }
  .mode input {
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 2px;
    accent-color: var(--c-accent);
  }
  .help {
    display: block;
    margin-top: var(--sp-1);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
