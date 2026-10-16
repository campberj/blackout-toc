<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Panel from '../../components/Panel.svelte';
  import Counter from '../../components/Counter.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import Icon from '../../components/Icon.svelte';
  import { toasts } from '../../components/toast.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import { missionDef, type CampaignState } from '$lib/domain/campaign';
  import ScalarField from './ScalarField.svelte';
  import PreviewPanel from './PreviewPanel.svelte';
  import { aarFieldSets, initAarDraft, isCasualtyField, toAarInput, validateAarDraft, type AarDraft } from './model/aar';
  import { diffStates, type StateDiff } from './model/preview';
  import { teamViews } from './model/roster';
  import type { CampaignSession } from './session.svelte';

  interface Props {
    session: CampaignSession;
    mission: string;
    /** Participants chosen on the briefing screen. */
    selected: string[];
  }
  let { session, mission, selected }: Props = $props();
  const app = useAppState();

  const campaign = $derived(session.campaign!);
  const cs = $derived(session.open!.state);
  const def = $derived(missionDef(campaign, cs, mission));
  const sets = $derived(def ? aarFieldSets(def) : null);
  const teams = $derived(teamViews(campaign, cs));

  let draft = $state<AarDraft | null>(null);
  let tried = $state(false);
  let filing = $state(false);
  let preview = $state<{ diff: StateDiff } | { error: string } | null>(null);
  // Snapshot so a filed AAR doesn't re-init the form from the new cs.
  let base: CampaignState | null = null;

  // Init once per mission: pre-fill from a linked dashboard session when one has ended.
  $effect(() => {
    if (draft || !def) return;
    base = cs;
    void app.ctx.gameBridge
      .prefillFor(session.id, mission)
      .catch(() => undefined)
      .then((prefill) => {
        draft = initAarDraft(campaign, cs, mission, { selected, prefill });
      });
  });

  const problems = $derived(def && draft ? validateAarDraft(def, draft) : []);
  const inputJson = $derived(draft ? JSON.stringify(toAarInput(draft)) : '');

  // Live preview (debounced): what the engine would do with this report.
  $effect(() => {
    const json = inputJson;
    if (!json || !draft || problems.length || !base) {
      preview = null;
      return;
    }
    const before = base;
    const t = setTimeout(async () => {
      const r = await session.preview({ type: 'resolveAar', aar: JSON.parse(json) });
      if (json !== inputJson) return;
      preview = r.ok ? { diff: diffStates(campaign, before, r.value.state) } : { error: r.error };
    }, 250);
    return () => clearTimeout(t);
  });

  async function file() {
    tried = true;
    if (!draft || problems.length) return;
    filing = true;
    const r = await session.run({ type: 'resolveAar', aar: toAarInput(draft) });
    filing = false;
    if (!r.ok) {
      toasts.push(r.error, 'crit', 8000);
      return;
    }
    await app.ctx.gameBridge.consume(session.id, mission).catch(() => undefined);
    const seq = r.value[0]?.seq ?? 1;
    router.go('/campaign', { save: session.id, debrief: String(seq), mission });
  }

  const OBSERVED: Record<string, { tone: 'ok' | 'warn' | 'crit'; label: string }> = {
    ok: { tone: 'ok', label: 'Table: unhurt' },
    damaged: { tone: 'warn', label: 'Table: damaged' },
    down: { tone: 'crit', label: 'Table: down' },
    destroyed: { tone: 'crit', label: 'Table: destroyed' },
  };
</script>

{#if !def || !sets}
  <EmptyState title="Mission not found" message={`"${mission}" is not part of this campaign.`} icon="alert">
    {#snippet action()}<Button href={href('/campaign', { save: session.id })}>Back to operations</Button>{/snippet}
  </EmptyState>
{:else if !draft}
  <p class="muted">Preparing report…</p>
{:else}
  <div class="aar">
    <div class="crumbs">
      <a href={href('/campaign', { save: session.id })}>Operations</a> <span aria-hidden="true">/</span>
      <a href={href('/campaign', { save: session.id, brief: mission })}>Briefing</a> <span aria-hidden="true">/</span> After-action report
    </div>
    <h2 class="mname">{def.name}</h2>
    {#if draft.prefilled}
      <p class="prefill" role="status"><Icon name="info" size={16} />Pre-filled from your dashboard game{draft.rounds ? ` (${draft.rounds} rounds)` : ''}. Check every line before filing; casualty rolls still come from you.</p>
    {/if}

    <div class="cols">
      <form class="left" onsubmit={(e) => { e.preventDefault(); void file(); }}>
        <Panel title="Outcome" level={3}>
          <div class="outcomes" role="radiogroup" aria-label="Outcome" aria-invalid={tried && !draft.outcome ? 'true' : undefined}>
            {#each def.outcomes as o (o.key)}
              <label class="outcome" class:on={draft.outcome === o.key}>
                <input type="radio" name="outcome" value={o.key} bind:group={draft.outcome} />
                <span>{o.name}</span>
              </label>
            {/each}
          </div>
          {#if sets.mission.length}
            <div class="mfields">
              {#each sets.mission as f (f.key)}
                <ScalarField def={f} value={draft.fields[f.key]} onchange={(v) => draft && (draft.fields[f.key] = v)} />
              {/each}
            </div>
          {/if}
        </Panel>

        <Panel title="Operators" level={3}>
          {#if sets.help.participated || sets.help.kills}
            <p class="help">{[sets.help.participated, sets.help.kills].filter(Boolean).join(' ')}</p>
          {/if}
          <div class="teams">
            {#each teams as t (t.key)}
              <section class="team" aria-labelledby="aar-{t.key}">
                <h4 id="aar-{t.key}" class="tname">{t.name}{#each t.badges as b (b.ladder)} <StatusBadge status={b.tone} label={b.label} />{/each}</h4>
                {#each t.operators as o (o.key)}
                  {@const row = draft.operators[o.key]}
                  {#if row}
                    <div class="op" class:on={row.participated}>
                      <div class="ophead">
                        <label class="dep">
                          <input type="checkbox" bind:checked={row.participated} />
                          <span class="oname">{o.name}</span>
                          {#if o.callsign}<span class="mono call">{o.callsign}</span>{/if}
                        </label>
                        <span class="obadges">
                          {#each o.badges as b (b.ladder)}<StatusBadge status={b.tone} label={b.label} />{/each}
                          {#if row.observed}<StatusBadge status={OBSERVED[row.observed]!.tone} label={OBSERVED[row.observed]!.label} />{/if}
                        </span>
                      </div>
                      {#if row.participated}
                        <div class="opfields">
                          <Counter label="Kills" bind:value={row.kills} />
                          {#each sets.operator as f (f.key)}
                            <ScalarField
                              def={f}
                              value={row.fields[f.key]}
                              hideHelp
                              hint={row.observed && isCasualtyField(f) ? `Dashboard saw: ${row.observed}.` : undefined}
                              onchange={(v) => (row.fields[f.key] = v)}
                            />
                          {/each}
                          <label class="onote">
                            <span class="lbl">Note</span>
                            <input class="control" bind:value={row.notes} maxlength="280" placeholder="Optional, goes in their service record" />
                          </label>
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </section>
            {/each}
          </div>
          {#if sets.operator.some((f) => f.help)}
            <details class="fhelp">
              <summary>Field guidance</summary>
              <dl>{#each sets.operator.filter((f) => f.help) as f (f.key)}<dt>{f.label}</dt><dd>{f.help}</dd>{/each}</dl>
            </details>
          {/if}
        </Panel>

        <Panel title="Notes" level={3}>
          <label class="sr-only" for="aar-notes">Mission notes</label>
          <textarea id="aar-notes" class="control" rows="4" bind:value={draft.notes} placeholder="What happened at the table"></textarea>
        </Panel>
      </form>

      <aside class="right">
        <Panel title="If you file this report" level={3}>
          {#if problems.length}
            <ul class="problems" role={tried ? 'alert' : undefined}>{#each problems as p (p)}<li>{p}</li>{/each}</ul>
          {:else if !preview}
            <p class="muted">Calculating…</p>
          {:else if 'error' in preview}
            <p class="problems" role="alert">{preview.error}</p>
          {:else}
            <PreviewPanel diff={preview.diff} />
          {/if}
        </Panel>
        <Button variant="primary" size="lg" block disabled={filing || session.busy || (tried && problems.length > 0)} onclick={file}>{filing ? 'Filing…' : 'File report'}</Button>
        <Button variant="ghost" block href={href('/campaign', { save: session.id })}>Cancel</Button>
      </aside>
    </div>
  </div>
{/if}

<style>
  .aar {
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
  .prefill {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--c-info);
    background: color-mix(in srgb, var(--c-info) 9%, transparent);
    font-size: var(--fs-sm);
  }
  .cols {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 1100px) {
    .cols {
      grid-template-columns: minmax(0, 1.4fr) minmax(20rem, 1fr);
    }
    .right {
      position: sticky;
      top: calc(var(--banner-h) + var(--header-h) + var(--sp-3));
      max-height: calc(100dvh - var(--banner-h) - var(--header-h) - var(--sp-5));
      overflow-y: auto;
    }
  }
  .left,
  .right {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: 0;
  }
  .right {
    gap: var(--sp-2);
  }
  .outcomes {
    display: grid;
    gap: var(--sp-2);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  }
  .outcome {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch-lg);
    padding: 0 var(--sp-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    background: var(--c-surface-2);
    font-weight: var(--fw-medium);
    cursor: pointer;
  }
  .outcome.on {
    border-color: var(--c-accent);
    background: color-mix(in srgb, var(--c-accent) 12%, var(--c-surface-2));
  }
  .outcome input {
    accent-color: var(--c-accent);
    width: 1.1rem;
    height: 1.1rem;
  }
  .outcome:focus-within {
    box-shadow: var(--focus-ring);
  }
  .mfields {
    display: grid;
    gap: var(--sp-2) var(--sp-4);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    margin-top: var(--sp-4);
    padding-top: var(--sp-4);
    border-top: 1px solid var(--c-border);
  }
  .help {
    margin-bottom: var(--sp-3);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .teams {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .tname {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-bottom: var(--sp-2);
    font-size: var(--fs-md);
  }
  .op {
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
    margin-bottom: var(--sp-2);
  }
  .op.on {
    border-color: var(--c-border-strong);
    background: var(--c-surface-2);
  }
  .ophead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: 0 var(--sp-3);
  }
  .dep {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch-lg);
    cursor: pointer;
  }
  .dep input {
    width: 1.3rem;
    height: 1.3rem;
    accent-color: var(--c-accent);
  }
  .oname {
    font-weight: var(--fw-bold);
  }
  .call {
    color: var(--c-accent);
    font-size: var(--fs-sm);
  }
  .obadges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }
  .opfields {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    align-items: end;
    padding: var(--sp-3);
    border-top: 1px solid var(--c-border);
  }
  .onote {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    grid-column: 1 / -1;
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .fhelp {
    margin-top: var(--sp-3);
    font-size: var(--fs-sm);
  }
  .fhelp summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    color: var(--c-accent);
    cursor: pointer;
  }
  .fhelp dt {
    font-weight: var(--fw-bold);
    margin-top: var(--sp-2);
  }
  .fhelp dd {
    color: var(--c-text-muted);
  }
  .problems {
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--c-crit);
    font-size: var(--fs-sm);
  }
  .muted {
    color: var(--c-text-muted);
  }
</style>
