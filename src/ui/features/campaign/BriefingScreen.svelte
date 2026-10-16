<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Panel from '../../components/Panel.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import { toasts } from '../../components/toast.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import { missionDef, type FeedEntry } from '$lib/domain/campaign';
  import Transmission from './Transmission.svelte';
  import ScenarioSetup from './ScenarioSetup.svelte';
  import OperatorPicker from './OperatorPicker.svelte';
  import { launchRequest, scenarioOf } from './model/missions';
  import { resolveNarrative } from './model/narrative';
  import { selectionWarnings, teamViews } from './model/roster';
  import type { CampaignSession } from './session.svelte';

  interface Props {
    session: CampaignSession;
    mission: string;
  }
  let { session, mission }: Props = $props();
  const app = useAppState();

  const campaign = $derived(session.campaign!);
  const cs = $derived(session.open!.state);
  const def = $derived(missionDef(campaign, cs, mission));
  const scenario = $derived(def ? scenarioOf(campaign, def, app.registry ?? undefined) : null);
  const teams = $derived(teamViews(campaign, cs));
  let selected = $state<string[]>([]);
  const warnings = $derived(selectionWarnings(teams, selected));
  let briefing = $state<FeedEntry[] | null>(null);
  let launching = $state(false);

  // Rendered briefing: dry-run beginMission (engine renders {{vars}} + onMissionStart traffic).
  // Already active → read what beginMission wrote to the feed.
  $effect(() => {
    const s = cs;
    if (s.activeMission === mission) {
      const begun = [...session.open!.save.events].reverse().find((e) => e.type === 'MissionBegun' && (e.payload as { mission?: string }).mission === mission);
      briefing = begun ? s.feed.filter((f) => f.seq === begun.seq && f.kind !== 'system') : [];
      return;
    }
    void session.preview({ type: 'beginMission', mission }).then((r) => {
      const lastId = s.feed.at(-1)?.id ?? 0;
      briefing = r.ok ? r.value.state.feed.filter((f) => f.id > lastId && f.kind !== 'system') : null;
    });
  });

  // Fallback when the preview is refused (e.g. another mission active): authored text, vars unrendered.
  const staticBrief = $derived.by(() => {
    const n = def ? resolveNarrative(campaign, def.briefing) : null;
    if (!n) return [];
    const p = campaign.personas.find((x) => x.key === n.speaker);
    return [{ kind: 'narrative' as const, title: n.title, text: n.text, seq: 0, speaker: p ? { key: p.key, name: p.name, callsign: p.callsign ?? null } : null }];
  });

  const aarHref = $derived(href('/campaign', { save: session.id, aar: mission, ...(selected.length ? { ops: selected.join(',') } : {}) }));

  async function play() {
    const req = launchRequest(campaign, cs, session.id, mission, selected);
    if (!req) return;
    launching = true;
    try {
      const sessionId = await app.ctx.gameBridge.launch(req);
      if (cs.activeMission !== mission) {
        const r = await session.run({ type: 'beginMission', mission });
        if (!r.ok) toasts.push(`Game started, but the mission could not be marked begun: ${r.error}`, 'warn');
      }
      router.go('/dashboard', { session: sessionId });
    } catch (e) {
      toasts.push(`Dashboard unavailable (${e instanceof Error ? e.message : String(e)}). Enter the after-action report directly.`, 'warn', 6000);
      location.hash = aarHref.slice(1);
    } finally {
      launching = false;
    }
  }
</script>

{#if !def}
  <EmptyState title="Mission not found" message={`"${mission}" is not part of this campaign.`} icon="alert">
    {#snippet action()}<Button href={href('/campaign', { save: session.id })}>Back to operations</Button>{/snippet}
  </EmptyState>
{:else}
  <div class="brief">
    <div class="crumbs"><a href={href('/campaign', { save: session.id })}>Operations</a> <span aria-hidden="true">/</span> Briefing</div>
    <h2 class="mname">{def.name}</h2>

    <div class="cols">
      <div class="left">
        <section class="traffic" aria-label="Briefing">
          {#each briefing ?? staticBrief as e, i (i)}
            <Transmission entry={e} size="lg" />
          {:else}
            <p class="muted">No briefing text for this mission.</p>
          {/each}
        </section>
        <Panel title="Mission details" level={3}>
          <ScenarioSetup {scenario} objectives={def.objectives} />
        </Panel>
      </div>

      <div class="right">
        <Panel title="Select operators" level={3}>
          <OperatorPicker {teams} bind:selected />
        </Panel>
        {#if warnings.length}
          <ul class="warns" role="list" aria-label="Readiness warnings">
            {#each warnings as w (w.text)}<li class={w.tone}><Icon name="alert" size={16} />{w.text}</li>{/each}
          </ul>
        {/if}
        <div class="go">
          <Button variant="primary" size="lg" block disabled={!selected.length || launching} onclick={play}>{launching ? 'Starting game…' : 'Play with dashboard'}</Button>
          <Button size="lg" block href={aarHref}>Enter after-action report directly</Button>
          <p class="muted small">{selected.length ? `${selected.length} operator${selected.length === 1 ? '' : 's'} selected.` : 'Select who deploys to play on the dashboard.'}</p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .brief {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .crumbs {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .mname {
    font-size: var(--fs-2xl);
  }
  .cols {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 1100px) {
    .cols {
      grid-template-columns: minmax(0, 1.25fr) minmax(22rem, 1fr);
    }
    .right {
      position: sticky;
      top: calc(var(--banner-h) + var(--header-h) + var(--sp-3));
    }
  }
  .left,
  .right {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: 0;
  }
  .traffic {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding: var(--sp-5);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
  }
  .warns {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .warns li {
    --tone: var(--c-warn);
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--tone);
    background: color-mix(in srgb, var(--tone) 9%, transparent);
    font-size: var(--fs-sm);
  }
  .warns li.crit {
    --tone: var(--c-crit);
  }
  .warns :global(svg) {
    color: var(--tone);
    flex: none;
  }
  .go {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .muted {
    color: var(--c-text-muted);
  }
  .small {
    font-size: var(--fs-sm);
  }
</style>
