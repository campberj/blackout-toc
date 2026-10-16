<script lang="ts">
  import { formatIssue, hasErrors, toCardViewModel } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import { router } from '../../router.svelte';
  import { fieldMessage, splitBySeverity } from '../../components/issues';
  import { toasts } from '../../components/toast.svelte';
  import Button from '../../components/Button.svelte';
  import CardView from '../../components/card/CardView.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import IssueList from '../../components/IssueList.svelte';
  import Panel from '../../components/Panel.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import KeywordPicker from './KeywordPicker.svelte';
  import NumField from './NumField.svelte';
  import RuleList from './RuleList.svelte';
  import SpecialistList from './SpecialistList.svelte';
  import TrackList from './TrackList.svelte';
  import WeaponList from './WeaponList.svelte';
  import { formToDraft, localId, previewUnit, UNIT_TYPE_OPTIONS, type UnitForm } from './forge-form';

  interface Props {
    initial: UnitForm;
    /** Qualified id of the unit being edited; undefined = new. */
    editingId?: string | undefined;
  }

  let { initial, editingId }: Props = $props();
  const app = useAppState();

  // Working copy; the page remounts the editor (keyed) per unit.
  // svelte-ignore state_referenced_locally
  let form = $state<UnitForm>($state.snapshot(initial) as UnitForm);
  let saving = $state(false);
  let confirmDelete = $state(false);

  const reg = $derived(app.registry!);
  const keywords = $derived(reg.list('keyword'));
  const factions = $derived([...reg.list('faction')].sort((a, b) => a.name.localeCompare(b.name)));
  const draft = $derived(formToDraft($state.snapshot(form) as UnitForm));
  const issues = $derived.by(() => {
    void app.snapshot;
    void app.activeRulesetId;
    return app.ctx.customUnits.validate(draft, editingId);
  });
  const split = $derived(splitBySeverity(issues));
  const blocked = $derived(hasErrors(issues));
  const preview = $derived.by(() => toCardViewModel(previewUnit($state.snapshot(form) as UnitForm), { lookup: reg, rulesetId: app.activeRulesetId }));
  const msg = (path: string) => fieldMessage(issues, path);

  async function save() {
    saving = true;
    const r = editingId ? await app.ctx.customUnits.update(editingId, draft) : await app.ctx.customUnits.create(draft);
    saving = false;
    if (!r.ok) {
      toasts.push(`Not saved: ${r.error.map(formatIssue).join('; ')}`, 'crit', 0);
      return;
    }
    const w = r.value.warnings.filter((i) => i.severity === 'warning').length;
    toasts.push(`Saved “${r.value.unit.name}”${w ? ` with ${w} warning${w === 1 ? '' : 's'}` : ''}`, 'ok');
    router.go('/forge', { id: localId(r.value.unit.id) });
  }

  async function remove() {
    if (!editingId) return;
    const r = await app.ctx.customUnits.remove(editingId);
    if (!r.ok) return toasts.push(r.error.map(formatIssue).join('; '), 'crit');
    toasts.push(`Deleted “${form.name}”`, 'ok');
    router.go('/forge');
  }
</script>

<div class="forge">
  <div class="form">
    <Panel title="Identity">
      <div class="grid">
        <Field label="Unit name" required error={msg('name')}>
          {#snippet control(a)}<input class="control" maxlength="80" {...a} bind:value={form.name} />{/snippet}
        </Field>
        <Field label="Faction" required error={msg('faction')} {...factions.length ? {} : { hint: 'No factions loaded. Import a pack that defines one.' }}>
          {#snippet control(a)}
            <select class="control" {...a} bind:value={form.faction}>
              <option value="">Choose a faction…</option>
              {#each factions as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
            </select>
          {/snippet}
        </Field>
        <Field label="Type" required error={msg('type')}>
          {#snippet control(a)}
            <select class="control" {...a} bind:value={form.type}>
              {#each UNIT_TYPE_OPTIONS as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
            </select>
          {/snippet}
        </Field>
        <Field label="Card code" hint="Optional printed code" error={msg('code')}>
          {#snippet control(a)}<input class="control mono" maxlength="32" {...a} bind:value={form.code} />{/snippet}
        </Field>
      </div>
    </Panel>

    <Panel title="Profile">
      <div class="nums">
        <NumField label="Skill" required min={2} max={10} bind:value={form.skill} error={msg('skill')} />
        <NumField label="Move" required min={0} max={24} bind:value={form.move} error={msg('move')} />
        <NumField label="Armor dice" required min={1} max={3} bind:value={form.armorDice} error={msg('armor.dice') ?? msg('armor')} />
        <NumField label="Armor target" required min={2} max={10} bind:value={form.armorTarget} error={msg('armor.target')} />
        <NumField label="Grunts" required min={0} max={9} bind:value={form.grunts} error={msg('grunts')} />
        <NumField label="Combat loads" required min={0} max={9} bind:value={form.combatLoads} error={msg('combatLoads')} />
        <NumField label="Models" min={1} max={20} hint="Optional" bind:value={form.modelCount} error={msg('modelCount')} />
      </div>
      <div class="kw">
        <KeywordPicker label="Unit keywords" appliesTo="model" {keywords} bind:refs={form.keywords} errorAt={(i) => msg(`keywords.${i}.key`)} />
      </div>
    </Panel>

    <Panel title="Weapons ({form.weapons.length})">
      <p class="sec-msg">{msg('weapons') ?? ''}</p>
      <WeaponList bind:items={form.weapons} base="weapons" {msg} {keywords} />
    </Panel>

    <Panel title="Specialists ({form.specialists.length})">
      <p class="sec-msg">{msg('specialists') ?? ''}</p>
      <SpecialistList bind:items={form.specialists} {msg} {keywords} />
    </Panel>

    <Panel title="Unit rules ({form.rules.length})">
      <p class="sec-msg">{msg('rules') ?? ''}</p>
      <RuleList bind:items={form.rules} base="rules" {msg} />
    </Panel>

    <Panel title="Damage tracks">
      <TrackList bind:items={form.damageTracks} {msg} />
    </Panel>

    <Panel title="Notes">
      <Field label="Card text" hint="Optional flavour or extra rules text" error={msg('text')}>
        {#snippet control(a)}<textarea class="control" {...a} bind:value={form.text}></textarea>{/snippet}
      </Field>
    </Panel>
  </div>

  <aside class="side" aria-label="Preview and checks">
    <div class="actions">
      <div class="cluster">
        {#if blocked}
          <StatusBadge status="crit" label="{split.errors.length} error{split.errors.length === 1 ? '' : 's'}" />
        {:else}
          <StatusBadge status="ok" label="Valid" />
        {/if}
        {#if split.warnings.length}<StatusBadge status="warn" label="{split.warnings.length} warning{split.warnings.length === 1 ? '' : 's'}" />{/if}
      </div>
      <div class="cluster">
        <Button variant="primary" disabled={blocked || saving} onclick={save}><Icon name="check" size={18} />{editingId ? 'Save unit' : 'Create unit'}</Button>
        {#if editingId}<Button variant="danger" onclick={() => (confirmDelete = true)}><Icon name="trash" size={18} />Delete</Button>{/if}
      </div>
      {#if blocked}<p class="why">Fix the errors to save. Warnings never block.</p>{/if}
    </div>
    <IssueList {issues} showPath okMessage="Within the active ruleset’s limits." />
    <div class="preview">
      <CardView card={preview} variant="full" />
    </div>
  </aside>
</div>

<ConfirmDialog
  bind:open={confirmDelete}
  title="Delete custom unit?"
  message="“{form.name}” will be removed from your units pack. Rosters that use it will show it as missing."
  confirmLabel="Delete unit"
  onconfirm={remove}
/>

<style>
  .forge {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    order: -1;
  }
  @media (min-width: 1100px) {
    .forge {
      grid-template-columns: minmax(0, 1fr) 24rem;
    }
    .side {
      order: 0;
      position: sticky;
      top: calc(var(--banner-h) + var(--header-h) + var(--sp-3));
      max-height: calc(100dvh - var(--banner-h) - var(--header-h) - var(--sp-5));
      overflow-y: auto;
    }
  }
  @media (min-width: 700px) and (max-width: 1099px) {
    .side {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
    .actions {
      grid-column: 1 / -1;
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-3);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-top: 2px solid var(--c-accent);
  }
  .why {
    width: 100%;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .grid {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  }
  .nums {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  }
  .kw {
    margin-top: var(--sp-4);
  }
  .sec-msg {
    color: var(--c-crit);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .sec-msg:empty {
    display: none;
  }
</style>
