<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { toasts } from '../../components/toast.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import { missionDef } from '$lib/domain/campaign';
  import StageHeader from './StageHeader.svelte';
  import StatusBoard from './StatusBoard.svelte';
  import MissionCard from './MissionCard.svelte';
  import CommsFeed from './CommsFeed.svelte';
  import PendingChoices from './PendingChoices.svelte';
  import CustomMissionDialog from './CustomMissionDialog.svelte';
  import ManualAdjustDialog from './ManualAdjustDialog.svelte';
  import RandomEventDialog from './RandomEventDialog.svelte';
  import { stageView } from './model/stage';
  import { missionCards } from './model/missions';
  import { choiceViews } from './model/choices';
  import { campaignTables } from './model/tables';
  import { lastCommand } from './model/feed';
  import type { CampaignSession } from './session.svelte';

  interface Props {
    session: CampaignSession;
  }
  let { session }: Props = $props();
  const app = useAppState();

  const open = $derived(session.open!);
  const campaign = $derived(session.campaign!);
  const cs = $derived(open.state);
  const stage = $derived(stageView(campaign, cs));
  const cards = $derived(missionCards(campaign, cs, open.available, app.registry ?? undefined));
  const choices = $derived(choiceViews(campaign, cs));
  const tables = $derived(app.registry ? campaignTables(campaign, app.registry) : []);
  const undoable = $derived(lastCommand(campaign, open.save.events));
  const active = $derived(cs.activeMission ? missionDef(campaign, cs, cs.activeMission) : undefined);
  const done = $derived(cs.status === 'complete');

  let advanceOpen = $state(false);
  let forceOpen = $state(false);
  let undoOpen = $state(false);
  let customOpen = $state(false);
  let gmOpen = $state(false);
  let rollOpen = $state(false);
  let abortOpen = $state(false);

  async function advance(force: boolean) {
    advanceOpen = false;
    const before = open.save.events.length;
    const r = await session.run({ type: 'advanceStage', force });
    if (!r.ok) return toasts.push(r.error, 'crit');
    const seq = r.value[0]?.seq ?? before + 1;
    router.go('/campaign', { save: session.id, debrief: String(seq) });
  }

  async function undo() {
    const r = await session.undo();
    toasts.push(r.ok ? `Undone: ${undoable?.label ?? 'last action'}.` : r.error, r.ok ? 'ok' : 'crit');
  }

  async function abort() {
    const r = await session.run({ type: 'cancelMission' });
    toasts.push(r.ok ? 'Mission aborted; it is available again.' : r.error, r.ok ? 'ok' : 'crit');
  }
</script>

<div class="ops">
  <div class="main">
    {#if stage}
      <StageHeader {stage} complete={cs.stageComplete}>
        {#snippet actions()}
          {#if !done}
            {#if cs.stageComplete}
              <Button variant="primary" disabled={session.busy || !!cs.activeMission} onclick={() => (advanceOpen = true)}>{stage.last ? 'Complete campaign' : 'Advance to next stage'}</Button>
            {/if}
            <Button disabled={!tables.length || session.busy} onclick={() => (rollOpen = true)}>Roll random event</Button>
            <Button disabled={!stage.allowCustomMissions || session.busy} onclick={() => (customOpen = true)}>Add custom mission</Button>
          {/if}
          <Button disabled={session.busy} onclick={() => (gmOpen = true)}>GM adjustment</Button>
          {#if !done && !cs.stageComplete}
            <Button variant="ghost" disabled={session.busy || !!cs.activeMission} onclick={() => (forceOpen = true)}>End stage early</Button>
          {/if}
          <Button variant="ghost" disabled={!undoable || session.busy} onclick={() => (undoOpen = true)} title={undoable ? `Undo: ${undoable.label}${undoable.detail ? ` (${undoable.detail})` : ''}` : 'Nothing to undo'}>Undo last action</Button>
        {/snippet}
      </StageHeader>
    {/if}

    {#if choices.length}<PendingChoices {choices} {session} />{/if}

    <StatusBoard {campaign} {cs} />

    <section class="missions" aria-labelledby="missions-h">
      <h2 id="missions-h" class="h">{active ? 'Mission in progress' : 'Available missions'}</h2>
      {#if active}
        <div class="active">
          <p class="aname">{active.name}</p>
          <p class="muted">Begun and awaiting its after-action report. If you played it on the dashboard, results will pre-fill.</p>
          <div class="cluster">
            <Button variant="primary" href={href('/campaign', { save: session.id, aar: active.key })}>File after-action report</Button>
            <Button variant="ghost" href={href('/campaign', { save: session.id, brief: active.key })}>Re-read briefing</Button>
            <Button variant="danger" onclick={() => (abortOpen = true)}>Abort mission</Button>
          </div>
        </div>
      {:else if done}
        <EmptyState title="Campaign complete" message="The final stage is closed. Your roster and log remain here; export the save to keep a copy." icon="check" />
      {:else if cards.length}
        <div class="cards">
          {#each cards as c (c.key)}<MissionCard card={c} briefHref={href('/campaign', { save: session.id, brief: c.key })} />{/each}
        </div>
      {:else}
        <EmptyState
          title="No missions open"
          message={cs.stageComplete ? 'This stage is done. Advance when ready.' : stage?.allowCustomMissions ? 'Nothing is tasked yet. Roll a tasking table or add a custom mission.' : 'Nothing is tasked yet.'}
          icon="campaign"
        />
      {/if}
    </section>
  </div>

  <aside class="side">
    <CommsFeed {campaign} feed={cs.feed} events={open.save.events} />
  </aside>
</div>

<Dialog bind:open={advanceOpen} title={stage?.last ? 'Complete the campaign?' : 'Advance to the next stage?'}>
  <p>{stage?.last ? 'This closes the final stage and ends the campaign.' : `End ${stage?.name ?? 'this stage'} and receive the next orders. Stage-end effects (recovery, reinforcements) apply now.`}</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (advanceOpen = false)}>Cancel</Button>
    <Button variant="primary" onclick={() => advance(false)}>{stage?.last ? 'Complete campaign' : 'Advance'}</Button>
  {/snippet}
</Dialog>

<ConfirmDialog
  bind:open={forceOpen}
  title="End this stage early?"
  message={`${stage?.name ?? 'This stage'} still has ${Math.max(0, (stage?.required ?? 0) - (stage?.resolvedRequired ?? 0))} required mission(s) open. Ending it now is a GM override and is logged. Undo is available afterwards.`}
  confirmLabel="End stage early"
  onconfirm={() => advance(true)}
/>

<ConfirmDialog
  bind:open={undoOpen}
  title="Undo last action?"
  message={undoable ? `This removes "${undoable.label}${undoable.detail ? `: ${undoable.detail}` : ''}" and everything it caused. There is no redo.` : ''}
  confirmLabel="Undo"
  onconfirm={undo}
/>

<ConfirmDialog bind:open={abortOpen} title="Abort mission?" message="The mission returns to the available list as if it never began. Nothing is recorded." confirmLabel="Abort mission" onconfirm={abort} />

<CustomMissionDialog bind:open={customOpen} {session} {campaign} {cs} />
<ManualAdjustDialog bind:open={gmOpen} {session} {campaign} {cs} />
<RandomEventDialog bind:open={rollOpen} {session} {tables} />

<style>
  .ops {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 1100px) {
    .ops {
      grid-template-columns: minmax(0, 1fr) minmax(22rem, 30rem);
    }
    .side {
      position: sticky;
      top: calc(var(--banner-h) + var(--header-h) + var(--sp-3));
      max-height: calc(100dvh - var(--banner-h) - var(--header-h) - var(--sp-5));
      overflow-y: auto;
      scrollbar-width: thin;
    }
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: 0;
  }
  .h {
    margin-bottom: var(--sp-3);
    font-size: var(--fs-lg);
  }
  .cards {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  }
  .active {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-4);
    border: 1px solid var(--c-accent);
    border-radius: var(--r-xs);
    background: var(--c-surface-1);
  }
  .aname {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .muted {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
