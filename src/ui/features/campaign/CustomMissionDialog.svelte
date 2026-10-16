<script lang="ts">
  import type { Campaign } from '$lib/packs/schema';
  import type { CampaignState } from '$lib/domain/campaign';
  import Dialog from '../../components/Dialog.svelte';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import EffectRowsEditor from './EffectRowsEditor.svelte';
  import { blankCustomMission, customAarSummary, toCustomMissionCommand, validateCustomMission, type CustomMissionDraft } from './model/custom-mission';
  import type { CampaignSession } from './session.svelte';
  import { toasts } from '../../components/toast.svelte';

  interface Props {
    open: boolean;
    session: CampaignSession;
    campaign: Campaign;
    cs: CampaignState;
  }
  let { open = $bindable(), session, campaign, cs }: Props = $props();
  // svelte-ignore state_referenced_locally (reset on every open)
  let draft = $state<CustomMissionDraft>(blankCustomMission(campaign));
  let tried = $state(false);
  let error = $state<string | null>(null);
  const problems = $derived(validateCustomMission(draft));
  const aar = $derived(customAarSummary(campaign));

  $effect(() => {
    if (open) {
      draft = blankCustomMission(campaign);
      tried = false;
      error = null;
    }
  });

  async function save() {
    tried = true;
    if (problems.length) return;
    const r = await session.run(toCustomMissionCommand(draft));
    if (!r.ok) {
      error = r.error;
      return;
    }
    open = false;
    toasts.push(`Custom mission added: ${draft.name.trim()}.`, 'ok');
  }
</script>

<Dialog bind:open title="Add custom mission">
  <form id="cm-form" class="stack" onsubmit={(e) => { e.preventDefault(); void save(); }}>
    <Field label="Mission name" required error={tried && !draft.name.trim() ? 'Name the mission.' : undefined}>
      {#snippet control(a)}<input class="control" {...a} bind:value={draft.name} maxlength="80" />{/snippet}
    </Field>
    <Field label="Briefing" hint="Shown as a transmission when the mission begins.">
      {#snippet control(a)}<textarea class="control mono" {...a} rows="4" bind:value={draft.briefing}></textarea>{/snippet}
    </Field>
    {#if campaign.personas.length}
      <Field label="Voiced by">
        {#snippet control(a)}
          <select class="control" {...a} bind:value={draft.speaker}>
            <option value="">Unattributed</option>
            {#each campaign.personas as p (p.key)}<option value={p.key}>{p.callsign ?? p.name}</option>{/each}
          </select>
        {/snippet}
      </Field>
    {/if}
    <fieldset class="group">
      <legend>Objectives</legend>
      {#each draft.objectives as o, i (i)}
        <div class="obj">
          <input class="control" aria-label="Objective {i + 1}" placeholder="Objective" bind:value={o.text} maxlength="280" />
          <input class="control mono pts" aria-label="Points for objective {i + 1}" type="number" placeholder="VP" value={o.points ?? ''} oninput={(e) => (o.points = e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))} />
          <label class="prim"><input type="checkbox" bind:checked={o.primary} />Primary</label>
          <IconButton icon="trash" label="Remove objective {i + 1}" onclick={() => (draft.objectives = draft.objectives.filter((_, j) => j !== i))} />
        </div>
      {/each}
      <div><Button onclick={() => draft.objectives.push({ text: '', primary: false, points: undefined })}>Add objective</Button></div>
    </fieldset>
    <fieldset class="group">
      <legend>Rewards on success</legend>
      <EffectRowsEditor {campaign} {cs} context="reward" bind:rows={draft.rewards} addLabel="Add reward" />
    </fieldset>
    <p class="note">The after-action report will ask for {aar.fields.length ? aar.fields.join(', ') : 'outcome and participants only'}. Outcomes: {aar.outcomes.join(', ')}.</p>
    {#if tried && problems.length}<ul class="problems" role="alert">{#each problems as p (p)}<li>{p}</li>{/each}</ul>{/if}
    {#if error}<p class="problems" role="alert">{error}</p>{/if}
  </form>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" type="submit" form="cm-form" disabled={session.busy}>Add mission</Button>
  {/snippet}
</Dialog>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  legend {
    margin-bottom: var(--sp-2);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .obj {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .obj > .control:first-child {
    flex: 1 1 12rem;
  }
  .pts {
    width: 5rem;
  }
  .prim {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: var(--touch);
    font-size: var(--fs-sm);
  }
  .prim input {
    accent-color: var(--c-accent);
  }
  .note {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .problems {
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--c-crit);
    font-size: var(--fs-sm);
  }
</style>
