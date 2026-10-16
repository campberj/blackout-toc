<script lang="ts">
  import { formatLoadError, type LibraryError, type PackInfo } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import { saveJsonText } from '../../state/files';
  import { toasts } from '../../components/toast.svelte';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import Switch from '../../components/Switch.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import Tag from '../../components/Tag.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';

  interface Props {
    packs: readonly PackInfo[];
    /** Re-read the pack list (some library calls change storage without a new snapshot). */
    refresh: () => Promise<void>;
  }

  let { packs, refresh }: Props = $props();
  const app = useAppState();

  let busy = $state<string | null>(null);
  let rowErrors = $state<Record<string, string[]>>({});
  let removing = $state<PackInfo | null>(null);
  let confirmOpen = $state(false);

  async function act(id: string, fn: () => Promise<{ ok: true } | { ok: false; error: LibraryError[] }>, done: string) {
    busy = id;
    const r = await fn();
    busy = null;
    rowErrors = { ...rowErrors, [id]: r.ok ? [] : r.error.map(formatLoadError) };
    if (r.ok) toasts.push(done, 'ok');
    await refresh();
  }

  const toggle = (p: PackInfo, on: boolean) =>
    act(p.id, () => app.ctx.library.setEnabled(p.id, on), `${p.title ?? p.id} ${on ? 'enabled' : 'disabled'}`);

  async function exportPack(p: PackInfo) {
    const r = await app.ctx.library.exportPack(p.id);
    if (r.ok) saveJsonText(`${p.id}-${p.version ?? 'pack'}`, r.value);
    else rowErrors = { ...rowErrors, [p.id]: r.error.map(formatLoadError) };
  }

  function askRemove(p: PackInfo) {
    removing = p;
    confirmOpen = true;
  }

  const countsLine = (p: PackInfo) =>
    Object.entries(p.counts)
      .map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`)
      .join(', ');
</script>

<ul class="packs" role="list">
  {#each packs as p (p.id)}
    <li class="pack" class:off={!p.enabled}>
      <div class="main">
        <div class="title-row">
          <h3 class="title">{p.title ?? p.id}</h3>
          <StatusBadge status={p.bundled ? 'info' : 'neutral'} label={p.bundled ? 'Bundled' : 'Imported'} />
          {#if p.errors.length > 0}<StatusBadge status="crit" label="Invalid" />{/if}
        </div>
        <p class="meta mono">{p.id} v{p.version ?? '?'}{#if p.author}<span class="by">by {p.author}</span>{/if}</p>
        {#if countsLine(p)}<p class="counts">{countsLine(p)}</p>{/if}
        {#if p.contentTags.length > 0}
          <div class="cluster tags">{#each p.contentTags as t (t)}<Tag>{t}</Tag>{/each}</div>
        {/if}
        {#each [...p.errors.map(formatLoadError), ...(rowErrors[p.id] ?? [])] as e, i (i)}
          <p class="err mono" role="alert">{e}</p>
        {/each}
      </div>
      <div class="actions">
        <Switch label="Enable {p.title ?? p.id}" checked={p.enabled} disabled={busy === p.id} onchange={(on) => toggle(p, on)} />
        <Button variant="ghost" onclick={() => exportPack(p)}><Icon name="download" size={18} />Export</Button>
        {#if !p.bundled}
          <Button variant="danger" disabled={busy === p.id} onclick={() => askRemove(p)}><Icon name="trash" size={18} />Remove</Button>
        {/if}
      </div>
    </li>
  {/each}
</ul>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Remove pack?"
  message="“{removing?.title ?? removing?.id}” will be deleted from this device. Rosters and campaigns that use its content will show missing cards until you import it again."
  confirmLabel="Remove pack"
  onconfirm={() => removing && act(removing.id, () => app.ctx.library.remove(removing!.id), `${removing.title ?? removing.id} removed`)}
/>

<style>
  .packs {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .pack {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-accent);
  }
  .pack.off {
    border-left-color: var(--c-border-strong);
  }
  .pack.off .title {
    color: var(--c-text-muted);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    min-width: 0;
    flex: 1 1 20rem;
  }
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .title {
    font-size: var(--fs-lg);
  }
  .meta {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .by {
    margin-left: var(--sp-3);
    font-family: var(--font-sans);
  }
  .counts {
    font-size: var(--fs-sm);
  }
  .tags {
    gap: var(--sp-1);
  }
  .err {
    color: var(--c-crit);
    font-size: var(--fs-sm);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-1);
  }
</style>
