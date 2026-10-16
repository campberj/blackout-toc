<script lang="ts">
  import { formatIssue, type Roster } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import { fileStem, saveJsonText } from '../../state/files';
  import { href } from '../../router.svelte';
  import { toasts } from '../../components/toast.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import { copyName, toNewInput, unitCount } from './roster-form';

  interface Props {
    rosters: readonly Roster[];
    refresh: () => Promise<void>;
  }

  let { rosters, refresh }: Props = $props();
  const app = useAppState();
  let deleting = $state<Roster | null>(null);
  let confirmOpen = $state(false);

  const rulesetName = (id: string) => app.registry?.get('ruleset', id as Roster['rulesetId'])?.name ?? id;
  const errors = (r: Roster) => {
    void app.snapshot;
    return app.ctx.rosters.validate(r).filter((i) => i.severity === 'error').length;
  };

  async function duplicate(r: Roster) {
    const res = await app.ctx.rosters.create({ ...toNewInput(r), name: copyName(r.name, rosters.map((x) => x.name)) });
    if (res.ok) toasts.push(`Duplicated as “${res.value.roster.name}”`, 'ok');
    else toasts.push(res.error.map(formatIssue).join('; '), 'crit');
    await refresh();
  }

  async function exportOne(r: Roster) {
    const res = await app.ctx.rosters.exportRoster(r.id);
    if (res.ok) saveJsonText(fileStem(r.name, 'roster'), res.value);
    else toasts.push(res.error, 'crit');
  }

  async function remove() {
    if (!deleting) return;
    await app.ctx.rosters.remove(deleting.id);
    toasts.push(`Deleted “${deleting.name}”`, 'ok');
    await refresh();
  }
</script>

<ul class="list" role="list">
  {#each rosters as r (r.id)}
    {@const n = errors(r)}
    <li class="row">
      <a class="open" href={href('/roster', { id: r.id })}>
        <span class="name">{r.name}</span>
        <span class="meta">{r.mode} roster, {rulesetName(r.rulesetId)}, {unitCount(r)} cards in {r.groups.length} group{r.groups.length === 1 ? '' : 's'}</span>
      </a>
      <StatusBadge status={n ? 'crit' : 'ok'} label={n ? `${n} issue${n === 1 ? '' : 's'}` : 'Legal'} />
      <div class="acts">
        <IconButton icon="copy" label="Duplicate {r.name}" onclick={() => duplicate(r)} />
        <IconButton icon="download" label="Export {r.name}" onclick={() => exportOne(r)} />
        <IconButton
          icon="trash"
          label="Delete {r.name}"
          onclick={() => {
            deleting = r;
            confirmOpen = true;
          }}
        />
      </div>
    </li>
  {/each}
</ul>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete roster?"
  message="“{deleting?.name}” will be deleted from this device. Export it first if you want a copy."
  confirmLabel="Delete roster"
  onconfirm={remove}
/>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
    padding: var(--sp-1) var(--sp-2) var(--sp-1) 0;
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-border-strong);
  }
  .row:hover {
    border-left-color: var(--c-accent);
  }
  .open {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1 1 18rem;
    min-height: var(--touch-lg);
    padding: var(--sp-2) var(--sp-4);
    color: var(--c-text);
    text-decoration: none;
  }
  .open:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .name {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .meta {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .meta::first-letter {
    text-transform: uppercase;
  }
  .acts {
    display: flex;
    gap: var(--sp-1);
  }
</style>
