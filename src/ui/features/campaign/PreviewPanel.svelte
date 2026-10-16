<script lang="ts">
  import StatusBadge from '../../components/StatusBadge.svelte';
  import type { StateDiff } from './model/preview';
  import Transmission from './Transmission.svelte';

  /* What a command will change, before it is committed (AAR preview) or after (debrief). */
  interface Props {
    diff: StateDiff;
    showNarrative?: boolean;
  }
  let { diff, showNarrative = false }: Props = $props();
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

<div class="diff">
  {#if diff.empty}
    <p class="muted">No roster or campaign changes.</p>
  {/if}
  {#if diff.operators.length}
    <section>
      <h4 class="h">Operators</h4>
      <ul class="ops" role="list">
        {#each diff.operators as o (o.key)}
          <li>
            <p class="who">{o.name}{#if o.callsign}<span class="mono call">{o.callsign}</span>{/if}</p>
            <div class="chg">
              {#if o.joined}<StatusBadge status="info" label="Joins the roster" />{/if}
              {#if o.removed}<StatusBadge status="crit" label="Removed: {o.removed.toUpperCase()}" />{/if}
              {#if o.xp}<span class="mono">XP {o.xp.from} → {o.xp.to} ({signed(o.xp.to - o.xp.from)})</span>{/if}
              {#if o.rank}<StatusBadge status="ok" label="Promoted to {o.rank.to}" />{/if}
              {#each o.ladders as l (l.ladder)}<StatusBadge status={l.to.tone} label="{l.ladderName}: {l.to.label}" />{/each}
              {#each o.stats as st (st.name)}<span class="mono">{st.name} {st.from} → {st.to}</span>{/each}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if diff.teams.length}
    <section>
      <h4 class="h">Teams</h4>
      <ul class="rows" role="list">
        {#each diff.teams as t (t.key)}
          <li>{t.name} {#each t.ladders as l (l.ladder)}<StatusBadge status={l.to.tone} label="{l.ladderName}: {l.from.label} → {l.to.label}" />{/each}</li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if diff.tracks.length || diff.pools.length || diff.assets.length}
    <section>
      <h4 class="h">Campaign</h4>
      <ul class="rows mono" role="list">
        {#each [...diff.tracks, ...diff.pools] as c (c.key)}<li>{c.name}: {c.from} → {c.to} ({signed(c.to - c.from)})</li>{/each}
        {#each diff.assets as a (a.key)}<li>{a.to > a.from ? 'Gained' : 'Lost'}: {a.name}{Math.abs(a.to - a.from) > 1 ? ` ×${Math.abs(a.to - a.from)}` : ''}</li>{/each}
      </ul>
    </section>
  {/if}
  {#if diff.missions.length}
    <section>
      <h4 class="h">Missions</h4>
      <ul class="rows" role="list">{#each diff.missions as m (m.key)}<li>{m.name}: {m.to === 'available' ? 'now available' : m.to}</li>{/each}</ul>
    </section>
  {/if}
  {#if diff.stageComplete}<p class="okline">Stage objectives will be complete.</p>{/if}
  {#if diff.newChoices}<p class="okline">{diff.newChoices} decision{diff.newChoices === 1 ? '' : 's'} will need your input.</p>{/if}
  {#if showNarrative && diff.narrative.length}
    <section class="tx">
      {#each diff.narrative as e (e.id)}<Transmission entry={e} />{/each}
    </section>
  {/if}
</div>

<style>
  .diff {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .h {
    margin-bottom: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
  }
  .ops {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .who {
    font-weight: var(--fw-medium);
  }
  .call {
    margin-left: var(--sp-2);
    color: var(--c-accent);
    font-size: var(--fs-sm);
  }
  .chg,
  .rows li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-1) var(--sp-2);
    font-size: var(--fs-sm);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .muted {
    color: var(--c-text-muted);
  }
  .okline {
    color: var(--c-ok);
    font-size: var(--fs-sm);
  }
  .tx {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
</style>
