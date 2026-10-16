<script lang="ts">
  import { formatIssue, type Roster } from '../../../app';
  import type { Id } from '$lib/packs/schema';
  import { useAppState } from '../../state/app-context.svelte';
  import { fileStem, saveJsonText } from '../../state/files';
  import { router } from '../../router.svelte';
  import { fieldMessage, unclaimed } from '../../components/issues';
  import { toasts } from '../../components/toast.svelte';
  import Button from '../../components/Button.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import IssueList from '../../components/IssueList.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import GroupEditor from './GroupEditor.svelte';
  import IdSelect from './IdSelect.svelte';
  import RosterPrint from './RosterPrint.svelte';
  import { ALL_MODES, byFaction, copyName, emptyGroup, modeOf, modeSummary, modesFor, toNewInput, unitOptions, withOptional } from './roster-form';

  interface Props {
    initial: Roster;
    isNew: boolean;
    /** Names of saved rosters (for duplicate naming). */
    names: readonly string[];
  }

  let { initial, isNew, names }: Props = $props();
  const app = useAppState();
  const rosters = app.ctx.rosters;

  // Editor owns a working copy; the page remounts it (keyed) when the route id changes.
  // svelte-ignore state_referenced_locally
  let draft = $state<Roster>($state.snapshot(initial) as Roster);
  // svelte-ignore state_referenced_locally
  let dirty = $state(isNew);
  let saving = $state(false);
  let confirmDelete = $state(false);

  const reg = $derived(app.registry!);
  const plain = $derived.by(() => $state.snapshot(draft) as Roster);
  const issues = $derived.by(() => {
    void app.snapshot;
    return rosters.validate(plain);
  });
  const errorCount = $derived(issues.filter((i) => i.severity === 'error').length);
  const rulesets = $derived(reg.list('ruleset'));
  const modes = $derived(modesFor(reg, draft.rulesetId));
  const mode = $derived(modeOf(reg, draft));
  const options = $derived(unitOptions(reg, mode));
  const printModel = $derived.by(() => {
    void app.snapshot;
    return rosters.printModel(plain);
  });
  const canAddGroup = $derived(draft.groups.length < (mode?.groups.max ?? 8));
  const FIELD_PATHS = ['name', 'rulesetId', 'mode', 'dusterId', 'notes'];
  const summary = $derived(unclaimed(issues, (p) => FIELD_PATHS.includes(p) || /^groups\.\d+(\.|$)/.test(p)));

  function edit(fn: (r: Roster) => Roster) {
    draft = fn($state.snapshot(draft) as Roster);
    dirty = true;
  }

  function setRuleset(id: string) {
    edit((r) => {
      const ms = modesFor(reg, id);
      return { ...r, rulesetId: id as Id, mode: ms.some((m) => m.mode === r.mode) ? r.mode : (ms[0]?.mode ?? r.mode) };
    });
  }

  /** Returns the saved id, or null when the schema rejected the draft. */
  async function save(): Promise<string | null> {
    saving = true;
    const r = isNew ? await rosters.create(toNewInput(plain)) : await rosters.update(plain);
    saving = false;
    if (!r.ok) {
      toasts.push(`Not saved: ${r.error.map(formatIssue).join('; ')}`, 'crit', 0);
      return null;
    }
    dirty = false;
    toasts.push(r.value.issues.length ? `Saved “${r.value.roster.name}” (${r.value.issues.length} rule issue(s) remain)` : `Saved “${r.value.roster.name}”`, 'ok');
    if (isNew) router.go('/roster', { id: r.value.roster.id });
    return r.value.roster.id;
  }

  async function exportJson() {
    const id = dirty || isNew ? await save() : draft.id;
    if (!id) return;
    const r = await rosters.exportRoster(id);
    if (r.ok) saveJsonText(fileStem(draft.name, 'roster'), r.value);
    else toasts.push(r.error, 'crit');
  }

  async function duplicate() {
    const r = await rosters.create({ ...toNewInput(plain), name: copyName(draft.name, names) });
    if (!r.ok) return toasts.push(`Not duplicated: ${r.error.map(formatIssue).join('; ')}`, 'crit');
    toasts.push(`Duplicated as “${r.value.roster.name}”`, 'ok');
    router.go('/roster', { id: r.value.roster.id });
  }

  async function remove() {
    await rosters.remove(draft.id);
    toasts.push(`Deleted “${draft.name}”`, 'ok');
    router.go('/roster');
  }
</script>

<div class="editor no-print">
  <div class="bar">
    <div class="status">
      {#if errorCount > 0}
        <StatusBadge status="crit" label="{errorCount} rule issue{errorCount === 1 ? '' : 's'}" />
      {:else}
        <StatusBadge status="ok" label="Legal" />
      {/if}
      {#if dirty}<StatusBadge status="warn" label="Unsaved" />{/if}
    </div>
    <div class="cluster">
      <Button variant="primary" disabled={saving} onclick={save}><Icon name="check" size={18} />Save roster</Button>
      <Button onclick={() => window.print()}><Icon name="print" size={18} />Print</Button>
      <Button variant="ghost" onclick={exportJson}><Icon name="download" size={18} />Export</Button>
      {#if !isNew}
        <Button variant="ghost" onclick={duplicate}><Icon name="copy" size={18} />Duplicate</Button>
        <Button variant="danger" onclick={() => (confirmDelete = true)}><Icon name="trash" size={18} />Delete</Button>
      {/if}
    </div>
  </div>

  <div class="top">
    <Field label="Team name" required error={fieldMessage(issues, 'name')}>
      {#snippet control(a)}
        <input class="control" {...a} value={draft.name} maxlength="80" oninput={(e) => edit((r) => ({ ...r, name: e.currentTarget.value }))} />
      {/snippet}
    </Field>
    <Field label="Ruleset" required error={fieldMessage(issues, 'rulesetId')}>
      {#snippet control(a)}
        <select class="control" {...a} value={draft.rulesetId} onchange={(e) => setRuleset(e.currentTarget.value)}>
          {#if !rulesets.some((r) => r.id === draft.rulesetId)}<option value={draft.rulesetId}>{draft.rulesetId} (not loaded)</option>{/if}
          {#each rulesets as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
        </select>
      {/snippet}
    </Field>
    <Field label="Mode" required error={fieldMessage(issues, 'mode')} hint={mode ? modeSummary(mode) : 'This ruleset defines no roster modes, so composition is not checked.'}>
      {#snippet control(a)}
        <select class="control" {...a} value={draft.mode} onchange={(e) => edit((r) => ({ ...r, mode: e.currentTarget.value as Roster['mode'] }))}>
          {#each modes.length ? modes.map((m) => ({ key: m.mode, name: m.name })) : ALL_MODES.map((k) => ({ key: k, name: k })) as m (m.key)}
            <option value={m.key}>{m.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>
  </div>

  <IssueList issues={summary} />

  <div class="groups">
    {#each draft.groups as g, i (i)}
      <GroupEditor
        group={g}
        index={i}
        lookup={reg}
        {options}
        {mode}
        {issues}
        onchange={(next) => edit((r) => ({ ...r, groups: r.groups.map((x, j) => (j === i ? next : x)) }))}
        onremove={draft.groups.length > 1 ? () => edit((r) => ({ ...r, groups: r.groups.filter((_, j) => j !== i) })) : undefined}
      />
    {/each}
  </div>
  <div class="cluster">
    <Button disabled={!canAddGroup} onclick={() => edit((r) => ({ ...r, groups: [...r.groups, emptyGroup()] }))}><Icon name="plus" size={18} />Add group</Button>
  </div>

  <div class="extras">
    {#if (mode?.dusters.max ?? 1) > 0}
      <IdSelect
        label="Duster"
        none="No duster"
        hint={mode?.dusters.replacesUnit ? 'Counts as one of group 1’s units' : 'Joins group 1'}
        value={draft.dusterId}
        groups={byFaction(reg, options.dusters)}
        error={fieldMessage(issues, 'dusterId')}
        onchange={(id) => edit((r) => withOptional(r, 'dusterId', id as Id))}
      />
    {/if}
    <Field label="Notes" error={fieldMessage(issues, 'notes')}>
      {#snippet control(a)}
        <textarea class="control" {...a} value={draft.notes} oninput={(e) => edit((r) => ({ ...r, notes: e.currentTarget.value }))}></textarea>
      {/snippet}
    </Field>
  </div>
</div>

<RosterPrint model={printModel} />

<ConfirmDialog
  bind:open={confirmDelete}
  title="Delete roster?"
  message="“{draft.name}” will be deleted from this device. Export it first if you want a copy."
  confirmLabel="Delete roster"
  onconfirm={remove}
/>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .bar {
    position: sticky;
    top: calc(var(--banner-h) + var(--header-h));
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-2) 0;
    background: var(--c-bg);
    border-bottom: 1px solid var(--c-border);
  }
  .status {
    display: flex;
    gap: var(--sp-2);
  }
  .top {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  }
  .groups {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
    align-items: start;
  }
  .extras {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    align-items: start;
  }
</style>
