<script lang="ts">
  import type { InlineScenario, Objective } from '$lib/packs/schema';

  /* Table setup, objectives and special rules from the mission's scenario. */
  interface Props {
    scenario: InlineScenario | null;
    objectives: readonly Objective[];
  }
  let { scenario, objectives }: Props = $props();
</script>

<div class="setup">
  {#if objectives.length}
    <section>
      <h3 class="h">Objectives</h3>
      <ul class="objs" role="list">
        {#each objectives as o (o.key)}
          <li class:primary={o.primary}>
            <span>{o.text}{#if o.primary}<span class="sr-only"> (primary)</span>{/if}</span>
            {#if o.points !== undefined}<span class="mono pts">{o.points > 0 ? '+' : ''}{o.points}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if scenario}
    <section>
      <h3 class="h">Table setup: {scenario.name}</h3>
      {#if scenario.lore}<p class="lore">{scenario.lore}</p>{/if}
      <dl class="facts">
        <div><dt>Table</dt><dd class="mono">{scenario.tableSize.width}×{scenario.tableSize.depth} {scenario.tableSize.unit}</dd></div>
        <div><dt>Rounds</dt><dd class="mono">{scenario.roundLimit}</dd></div>
        {#if scenario.hardpoints}<div><dt>Hardpoints</dt><dd class="mono">{scenario.hardpoints}</dd></div>{/if}
      </dl>
      {#if scenario.forces.sides.length}
        <ul class="sides" role="list">
          {#each scenario.forces.sides as side (side.key)}
            <li>
              <p class="sname">{side.name}</p>
              {#if side.text}<p class="stext">{side.text}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <p class="dep"><strong>Deployment.</strong> {scenario.deployment.text}</p>
      {#if scenario.pois.length}
        <h4 class="h4">Points of interest</h4>
        <ul class="rules" role="list">{#each scenario.pois as p (p.key)}<li><strong>{p.name}.</strong> {p.text ?? ''}</li>{/each}</ul>
      {/if}
    </section>

    {#if scenario.specialRules.length}
      <section>
        <h3 class="h">Special rules</h3>
        <ul class="rules" role="list">{#each scenario.specialRules as r (r.key)}<li><strong>{r.name}.</strong> {r.text ?? ''}</li>{/each}</ul>
      </section>
    {/if}

    {#if scenario.scoring.length || scenario.campaignReward}
      <section>
        <h3 class="h">Scoring</h3>
        {#if scenario.scoring.length}
          <ul class="objs" role="list">{#each scenario.scoring as s (s.key)}<li><span>{s.label}{s.max ? ` (max ${s.max})` : ''}</span><span class="mono pts">{s.points > 0 ? '+' : ''}{s.points} {scenario.scoreLabel}</span></li>{/each}</ul>
        {/if}
        {#if scenario.campaignReward}<p class="reward mono">{scenario.campaignReward}</p>{/if}
        {#if scenario.endConditions.length}<p class="stext">Ends: {scenario.endConditions.map((e) => e.text).join(' ')}</p>{/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  .setup {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .h {
    margin-bottom: var(--sp-2);
    font-size: var(--fs-md);
  }
  .h4 {
    margin: var(--sp-3) 0 var(--sp-1);
    font-size: var(--fs-sm);
  }
  .objs {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .objs li {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-1) 0 var(--sp-1) var(--sp-3);
    border-left: 2px solid var(--c-border);
  }
  .objs li.primary {
    border-left-color: var(--c-accent);
    font-weight: var(--fw-medium);
  }
  .pts {
    color: var(--c-text-muted);
    white-space: nowrap;
  }
  .lore,
  .stext {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-6);
    margin: var(--sp-3) 0;
  }
  .facts dt {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .facts dd {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .sides {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    margin-bottom: var(--sp-3);
  }
  .sides li {
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    background: var(--c-surface-2);
  }
  .sname {
    font-weight: var(--fw-bold);
  }
  .dep,
  .rules {
    font-size: var(--fs-sm);
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .reward {
    margin-top: var(--sp-2);
    font-size: var(--fs-sm);
  }
</style>
