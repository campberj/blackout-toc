<script lang="ts">
  import Page from '../../shell/Page.svelte';
  import Panel from '../../components/Panel.svelte';
  import Button from '../../components/Button.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Tag from '../../components/Tag.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';
  import type { Campaign, Id } from '$lib/packs/schema';
  import {
    blankRecruit,
    campaignOptions,
    canRecruit,
    initWizard,
    pickRule,
    teamSize,
    toCreateInput,
    toggleTeam,
    validateAll,
    validateStep,
    wizardSteps,
    type WizardDraft,
    type WizardStep,
  } from './model/wizard';
  import { qualify } from '$lib/domain/campaign';
  import ScalarField from './ScalarField.svelte';
  import Transmission from './Transmission.svelte';

  const app = useAppState();
  const options = $derived(app.registry ? campaignOptions(app.registry) : []);
  let draft = $state<WizardDraft | null>(null);
  let step = $state<WizardStep>('campaign');
  let tried = $state(false);
  let busy = $state(false);
  let startError = $state<string | null>(null);

  const campaign = $derived<Campaign | undefined>(draft ? app.registry?.get('campaign', draft.campaignId as Id) : undefined);
  const steps = $derived(wizardSteps(campaign));
  const stepIndex = $derived(steps.indexOf(step));
  const problems = $derived(campaign && draft ? validateStep(campaign, draft, step) : step === 'campaign' ? ['Pick a campaign.'] : []);
  const nameTable = $derived(campaign?.roster.nameTable ? app.registry?.get('table', qualify(campaign.id, campaign.roster.nameTable)) : undefined);
  const STEP_LABEL: Record<WizardStep, string> = { campaign: 'Campaign', faction: 'Faction', teams: 'Teams', confirm: 'Start' };

  // Preselect when exactly one campaign is loaded.
  $effect(() => {
    if (!draft && options.length === 1) pick(options[0]!.id);
  });

  function pick(id: string) {
    const c = app.registry?.get('campaign', id as Id);
    if (c) draft = initWizard(c);
  }

  function next() {
    tried = true;
    if (problems.length) return;
    tried = false;
    step = steps[stepIndex + 1] ?? step;
  }

  async function start() {
    if (!campaign || !draft) return;
    tried = true;
    const all = validateAll(campaign, draft);
    if (all.length) return;
    busy = true;
    startError = null;
    const r = await app.ctx.campaigns.create(toCreateInput(draft));
    busy = false;
    if (!r.ok) {
      startError = r.error;
      return;
    }
    router.go('/campaign', { save: r.value.save.id, debrief: '1' });
  }

  const operatorsOf = (key: string) => campaign?.roster.startingTeams.find((t) => t.key === key)?.operators ?? [];
  const introParas = (c: Campaign) => (c.intro ?? '').split(/\n\s*\n/).slice(0, 3).join('\n\n');
</script>

<Page title="New campaign" purpose="Choose a campaign, assemble your teams and receive your first orders.">
  {#snippet actions()}
    <Button variant="ghost" href={href('/campaign')}>Cancel</Button>
  {/snippet}

  {#if options.length === 0}
    <EmptyState title="No campaigns loaded" message="Import a campaign pack first; its campaigns will be listed here." icon="campaign">
      {#snippet action()}<Button variant="primary" href={href('/campaign')}>Go to import</Button>{/snippet}
    </EmptyState>
  {:else}
    <ol class="steps" aria-label="Steps">
      {#each steps as s, i (s)}
        <li class:current={s === step} class:done={i < stepIndex} aria-current={s === step ? 'step' : undefined}>
          <span class="n mono">{i + 1}</span>{STEP_LABEL[s]}
        </li>
      {/each}
    </ol>

    {#if step === 'campaign'}
      <div class="choices" role="radiogroup" aria-label="Campaign">
        {#each options as o (o.id)}
          <label class="choice" class:on={draft?.campaignId === o.id}>
            <input type="radio" name="campaign" class="sr-only" checked={draft?.campaignId === o.id} onchange={() => pick(o.id)} />
            <span class="cname">{o.name}</span>
            {#if o.summary}<span class="csum">{o.summary}</span>{/if}
            <span class="cpack mono">{o.packId}</span>
          </label>
        {/each}
      </div>
      {#if campaign?.intro}
        <Panel title="Situation">
          <Transmission entry={{ kind: 'narrative', title: null, text: introParas(campaign), speaker: null, seq: 0 }} size="lg" />
        </Panel>
      {/if}
    {:else if step === 'faction' && campaign && draft}
      <div class="choices" role="radiogroup" aria-label="Faction">
        {#each campaign.factions ?? [] as f (f.key)}
          <label class="choice" class:on={draft.faction === f.key}>
            <input type="radio" name="faction" class="sr-only" checked={draft.faction === f.key} onchange={() => draft && (draft.faction = f.key)} />
            <span class="cname">{f.name}</span>
            {#if f.text}<span class="csum">{f.text}</span>{/if}
          </label>
        {/each}
      </div>
    {:else if step === 'teams' && campaign && draft}
      <p class="rule">{pickRule(campaign)}{campaign.roster.operatorsPerTeam?.max ? ` Up to ${campaign.roster.operatorsPerTeam.max} operators per team.` : ''}</p>
      <div class="teams">
        {#each campaign.roster.startingTeams as t (t.key)}
          {@const picked = draft.teams.includes(t.key)}
          <section class="team" class:on={picked} aria-labelledby="team-{t.key}">
            <label class="thead">
              <input type="checkbox" checked={picked} onchange={() => draft && (draft = toggleTeam(draft, t.key))} />
              <span id="team-{t.key}" class="tname">{t.name}</span>
              {#if t.callsign}<span class="tcall mono">{t.callsign}</span>{/if}
            </label>
            {#if t.text}<p class="ttext">{t.text}</p>{/if}
            <ul class="ops" role="list">
              {#each operatorsOf(t.key) as o, i (o.key ?? i)}
                <li>
                  <span class="oname">{o.name ?? 'Unnamed recruit'}</span>
                  {#if o.callsign}<span class="mono ocall">{o.callsign}</span>{/if}
                  {#each o.tags as tag (tag)}<Tag>{tag}</Tag>{/each}
                </li>
              {/each}
            </ul>
            {#if picked}
              {#each draft.recruits[t.key] ?? [] as r, ri (ri)}
                <fieldset class="recruit">
                  <legend>Recruit {ri + 1}</legend>
                  <div class="rgrid">
                    <Field label="Name" {...r.name ? {} : { hint: `Blank: rolled from ${nameTable?.name ?? 'the name table'}` }}>
                      {#snippet control(a)}<input class="control" {...a} bind:value={r.name} maxlength="80" />{/snippet}
                    </Field>
                    <Field label="Callsign">
                      {#snippet control(a)}<input class="control mono" {...a} bind:value={r.callsign} maxlength="80" />{/snippet}
                    </Field>
                  </div>
                  {#if campaign.roster.operatorFields.length}
                    <details class="sheet">
                      <summary>Sheet details</summary>
                      <div class="rgrid">
                        {#each campaign.roster.operatorFields as f (f.key)}
                          <ScalarField def={f} value={r.fields[f.key]} onchange={(v) => { if (v === undefined) delete r.fields[f.key]; else r.fields[f.key] = v; }} />
                        {/each}
                      </div>
                    </details>
                  {/if}
                  <div class="rremove">
                    <IconButton icon="trash" label="Remove recruit {ri + 1}" onclick={() => draft && (draft.recruits[t.key] = (draft.recruits[t.key] ?? []).filter((_, j) => j !== ri))} />
                  </div>
                </fieldset>
              {/each}
              <div class="tfoot">
                <span class="mono size">{teamSize(campaign, draft, t.key)}{#if campaign.roster.operatorsPerTeam?.max}/{campaign.roster.operatorsPerTeam.max}{/if} operators</span>
                <Button
                  disabled={!canRecruit(campaign, draft, t.key)}
                  onclick={() => draft && campaign && (draft.recruits[t.key] = [...(draft.recruits[t.key] ?? []), blankRecruit(campaign)])}
                >Add recruit</Button>
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {:else if step === 'confirm' && campaign && draft}
      <Panel title="Ready to deploy">
        <div class="stack">
          <Field label="Save name" required error={tried && !draft.name.trim() ? 'Name the save.' : undefined}>
            {#snippet control(a)}<input class="control" {...a} bind:value={draft!.name} maxlength="80" />{/snippet}
          </Field>
          <dl class="summary">
            <dt>Campaign</dt><dd>{campaign.name}</dd>
            {#if draft.faction}<dt>Faction</dt><dd>{campaign.factions?.find((f) => f.key === draft!.faction)?.name}</dd>{/if}
            <dt>Teams</dt>
            <dd>{draft.teams.map((k) => campaign!.roster.startingTeams.find((t) => t.key === k)?.name ?? k).join(', ')}</dd>
            {#if app.settings?.excludedTags.length}
              <dt>Content filter</dt><dd>Skipping entries tagged {app.settings.excludedTags.join(', ')}</dd>
            {/if}
          </dl>
          {#if startError}<p class="err" role="alert">Could not start: {startError}</p>{/if}
        </div>
      </Panel>
    {/if}

    {#if tried && problems.length}
      <ul class="problems" role="alert">{#each problems as p (p)}<li>{p}</li>{/each}</ul>
    {/if}

    <div class="nav">
      {#if stepIndex > 0}<Button variant="ghost" onclick={() => { tried = false; step = steps[stepIndex - 1]!; }}>Back</Button>{/if}
      <span class="grow"></span>
      {#if step === 'confirm'}
        <Button variant="primary" size="lg" disabled={busy} onclick={start}>{busy ? 'Starting…' : 'Start campaign'}</Button>
      {:else}
        <Button variant="primary" size="lg" disabled={!draft} onclick={next}>Continue</Button>
      {/if}
    </div>
  {/if}
</Page>

<style>
  .steps {
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-5);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .n {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
  }
  .steps .current {
    color: var(--c-text);
    font-weight: var(--fw-bold);
  }
  .steps .current .n {
    border-color: var(--c-accent);
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
  .steps .done .n {
    border-color: var(--c-ok);
    color: var(--c-ok);
  }
  .choices {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  }
  .choice {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-4);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    background: var(--c-surface-1);
    cursor: pointer;
  }
  .choice:focus-within {
    box-shadow: var(--focus-ring);
  }
  .choice.on {
    border-color: var(--c-accent);
    box-shadow: inset 3px 0 0 var(--c-accent);
  }
  .cname {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .csum {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .cpack {
    color: var(--c-text-faint);
    font-size: var(--fs-xs);
  }
  .rule {
    color: var(--c-text-muted);
  }
  .teams {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    align-items: start;
  }
  .team {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    background: var(--c-surface-1);
  }
  .team.on {
    border-color: var(--c-accent);
  }
  .thead {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-3);
    min-height: var(--touch);
    cursor: pointer;
  }
  .thead input {
    width: 1.35rem;
    height: 1.35rem;
    accent-color: var(--c-accent);
  }
  .tname {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .tcall,
  .ocall {
    color: var(--c-accent);
    font-size: var(--fs-sm);
  }
  .ttext {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .ops {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .ops li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .recruit {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border: 1px dashed var(--c-border-strong);
    border-radius: var(--r-sm);
  }
  .recruit legend {
    padding: 0 var(--sp-1);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .rgrid {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  }
  .sheet summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--c-accent);
    font-size: var(--fs-sm);
  }
  .rremove {
    display: flex;
    justify-content: flex-end;
  }
  .tfoot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .size {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .summary {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--sp-2) var(--sp-4);
  }
  .summary dt {
    color: var(--c-text-muted);
  }
  .problems,
  .err {
    padding: var(--sp-3);
    border-left: 3px solid var(--c-crit);
    background: color-mix(in srgb, var(--c-crit) 8%, transparent);
    color: var(--c-text);
  }
  .nav {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--c-border);
  }
  .grow {
    flex: 1;
  }
</style>
