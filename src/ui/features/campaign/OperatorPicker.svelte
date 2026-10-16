<script lang="ts">
  import StatusBadge from '../../components/StatusBadge.svelte';
  import Tag from '../../components/Tag.svelte';
  import type { TeamView } from './model/roster';

  /* Choose mission participants; readiness and ladder states visible before committing. */
  interface Props {
    teams: readonly TeamView[];
    selected: string[];
  }
  let { teams, selected = $bindable() }: Props = $props();

  const toggle = (k: string) => (selected = selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  const toggleTeam = (t: TeamView) => {
    const keys = t.operators.map((o) => o.key);
    const all = keys.every((k) => selected.includes(k));
    selected = all ? selected.filter((k) => !keys.includes(k)) : [...new Set([...selected, ...keys])];
  };
</script>

<div class="picker">
  {#each teams as t (t.key)}
    {@const keys = t.operators.map((o) => o.key)}
    {@const picked = keys.filter((k) => selected.includes(k)).length}
    <section class="team tone-{t.tone}" aria-labelledby="pk-{t.key}">
      <header class="thead">
        <label class="tsel">
          <input type="checkbox" checked={picked > 0 && picked === keys.length} indeterminate={picked > 0 && picked < keys.length} disabled={!keys.length} onchange={() => toggleTeam(t)} />
          <span id="pk-{t.key}" class="tname">{t.name}</span>
          {#if t.callsign}<span class="tcall mono">{t.callsign}</span>{/if}
        </label>
        <div class="tbadges">
          {#each t.badges as b (b.ladder)}<StatusBadge status={b.tone} label="{b.ladderName}: {b.label}" />{/each}
          <span class="tasked mono">Tasked {t.stageMissions}× this stage</span>
        </div>
      </header>
      <ul class="ops" role="list">
        {#each t.operators as o (o.key)}
          <li>
            <label class="op" class:on={selected.includes(o.key)}>
              <input type="checkbox" checked={selected.includes(o.key)} onchange={() => toggle(o.key)} />
              <span class="who">
                <span class="oname">{o.name}</span>
                {#if o.callsign}<span class="ocall mono">{o.callsign}</span>{/if}
                {#each o.tags as tag (tag)}<Tag>{tag}</Tag>{/each}
              </span>
              <span class="badges">
                {#each o.badges as b (b.ladder)}<StatusBadge status={b.tone} label={b.label} />{/each}
              </span>
              <span class="meta mono">{o.rankName ?? ''}{o.rankName ? ', ' : ''}{o.xp.xp} XP, {o.missions} missions</span>
            </label>
          </li>
        {:else}
          <li class="none">No active operators.</li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .team {
    --tone: var(--c-border-strong);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--tone);
    border-radius: var(--r-xs);
    background: var(--c-surface-1);
  }
  .tone-ok {
    --tone: var(--c-ok);
  }
  .tone-warn {
    --tone: var(--c-warn);
  }
  .tone-crit {
    --tone: var(--c-crit);
  }
  .thead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-3);
    border-bottom: 1px solid var(--c-border);
  }
  .tsel {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    cursor: pointer;
  }
  input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--c-accent);
    flex: none;
  }
  .tname {
    font-weight: var(--fw-bold);
  }
  .tcall,
  .ocall {
    color: var(--c-accent);
    font-size: var(--fs-sm);
  }
  .tbadges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .tasked {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .ops li + li {
    border-top: 1px solid var(--c-border);
  }
  .op {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'box who badges' 'box meta badges';
    align-items: center;
    column-gap: var(--sp-3);
    min-height: var(--touch-lg);
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
  }
  .op.on {
    background: color-mix(in srgb, var(--c-accent) 8%, transparent);
  }
  .op input {
    grid-area: box;
  }
  .who {
    grid-area: who;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .oname {
    font-weight: var(--fw-medium);
  }
  .badges {
    grid-area: badges;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--sp-1);
  }
  .meta {
    grid-area: meta;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .none {
    padding: var(--sp-3);
    color: var(--c-text-muted);
  }
</style>
