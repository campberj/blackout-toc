<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Tag from '../../components/Tag.svelte';
  import type { MissionCard } from './model/missions';

  interface Props {
    card: MissionCard;
    briefHref: string;
  }
  let { card, briefHref }: Props = $props();
</script>

<article class="mission" class:optional={card.optional} aria-labelledby="m-{card.key}">
  <header class="head">
    <h3 id="m-{card.key}" class="name">{card.name}</h3>
    <div class="tags">
      {#if card.slotLabel}<Tag>{card.slotLabel}</Tag>{/if}
      {#if card.optional}<Tag>Optional</Tag>{/if}
      {#if card.repeatable}<Tag>Repeatable{card.resolutions ? `, run ${card.resolutions}×` : ''}</Tag>{/if}
    </div>
  </header>
  {#if card.preview}<p class="preview">{card.preview}</p>{/if}
  {#if card.objectives.length}
    <ul class="objs" role="list" aria-label="Objectives">
      {#each card.objectives as o (o.key)}
        <li class:primary={o.primary}>
          <span class="obj">{o.text}</span>
          {#if o.points !== undefined}<span class="pts mono">{o.points > 0 ? '+' : ''}{o.points}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
  <footer class="foot">
    {#if card.tableSize || card.rounds}
      <span class="meta mono">{[card.tableSize, card.rounds ? `${card.rounds} rounds` : null].filter(Boolean).join(', ')}</span>
    {/if}
    <Button variant="primary" href={briefHref}>Brief</Button>
  </footer>
</article>

<style>
  .mission {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-accent);
    border-radius: var(--r-xs);
  }
  .mission.optional {
    border-left-style: dashed;
    border-left-color: var(--c-border-strong);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .name {
    font-size: var(--fs-lg);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }
  .preview {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .objs {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    font-size: var(--fs-sm);
  }
  .objs li {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    padding-left: var(--sp-3);
    border-left: 2px solid var(--c-border);
  }
  .objs li.primary {
    border-left-color: var(--c-accent);
    font-weight: var(--fw-medium);
  }
  .pts {
    color: var(--c-text-muted);
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    margin-top: auto;
  }
  .meta {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
</style>
