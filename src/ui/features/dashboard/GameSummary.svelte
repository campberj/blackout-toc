<script lang="ts">
  import { score, SIDES, type GameState } from '$lib/app';
  import SideGlyph from '../../components/SideGlyph.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import { STATUS_META } from './board';

  /* Result at a glance: score, losses per side, and who scored kills. */
  interface Props {
    game: GameState;
  }

  let { game }: Props = $props();

  const sides = $derived(
    SIDES.map((side) => {
      const models = game.units.filter((u) => u.side === side).flatMap((u) => u.models.map((m) => ({ ...m, unit: u.name })));
      return {
        side,
        name: game.sides[side].name,
        score: score(game, side),
        lost: models.filter((m) => m.status === 'destroyed' || m.status === 'captured' || m.status === 'down'),
        killers: models.filter((m) => m.kills > 0).sort((a, b) => b.kills - a.kills),
        total: models.length,
      };
    }),
  );
  const leader = $derived(sides[0]!.score === sides[1]!.score ? null : sides[0]!.score > sides[1]!.score ? sides[0]! : sides[1]!);
</script>

<div class="summary">
  <p class="verdict">
    {leader ? `${leader.name} leads` : 'Scores are level'} after {game.round} round{game.round === 1 ? '' : 's'}.
  </p>
  <div class="cols">
    {#each sides as s (s.side)}
      <section class="col col-{s.side}" aria-label={s.name}>
        <h3 class="name"><SideGlyph side={s.side} /> {s.name}</h3>
        <p class="score mono">{s.score} <span>{game.scoreLabel}</span></p>
        <p class="muted">{s.lost.length} of {s.total} models down or lost</p>
        {#if s.lost.length > 0}
          <ul class="list" role="list">
            {#each s.lost as m (m.unit + m.key)}
              <li><span>{m.name}</span> <StatusBadge status={STATUS_META[m.status].tone} label={STATUS_META[m.status].label} /></li>
            {/each}
          </ul>
        {/if}
        {#if s.killers.length > 0}
          <ul class="list" role="list" aria-label="Kills">
            {#each s.killers as m (m.unit + m.key)}
              <li><span>{m.name}</span> <span class="mono kills">{m.kills} kill{m.kills === 1 ? '' : 's'}</span></li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .verdict {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: var(--sp-4);
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding-left: var(--sp-3);
    border-left: 3px solid var(--c-info);
  }
  .col-opfor {
    border-left-color: var(--c-crit);
  }
  .name {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-md);
  }
  .score {
    font-size: var(--fs-3xl);
    font-weight: var(--fw-bold);
    line-height: 1;
  }
  .score span {
    color: var(--c-text-muted);
    font-size: var(--fs-md);
  }
  .muted {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    padding: 2px 0;
    font-size: var(--fs-sm);
  }
  .kills {
    color: var(--c-accent);
  }
</style>
