<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import type { StageView } from './model/stage';

  /* Where we are on the timeline + required-slot progress. Actions render in the snippet. */
  interface Props {
    stage: StageView;
    complete: boolean;
    actions?: import('svelte').Snippet;
  }
  let { stage, complete, actions }: Props = $props();
</script>

<section class="stage" aria-labelledby="stage-h">
  <div class="where">
    <p class="count mono">Stage {stage.number} of {stage.total}</p>
    <h2 id="stage-h" class="name">{stage.name}</h2>
    {#if complete}
      <p class="state ok"><Icon name="check" size={16} />{stage.last ? 'Final stage complete. Advance to close the campaign.' : 'Objectives complete. Advance when ready.'}</p>
    {:else if stage.required}
      <p class="state">{stage.resolvedRequired} of {stage.required} required missions resolved{stage.hasEndCondition ? ' (or until the pack ends the stage)' : ''}</p>
    {:else}
      <p class="state">No fixed missions this stage.</p>
    {/if}
  </div>
  {#if stage.slots.length}
    <ul class="slots" role="list" aria-label="Mission slots">
      {#each stage.slots as s (s.key)}
        <li class:done={s.resolved} class:opt={s.optional} title={s.missions.join(' / ')}>
          <span class="box" aria-hidden="true">{#if s.resolved}<Icon name="check" size={14} />{/if}</span>
          <span class="slabel">{s.label}</span>
          <span class="sm">{s.missions.join(' / ')}</span>
          <span class="sr-only">{s.resolved ? 'resolved' : 'open'}{s.optional ? ', optional' : ''}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if actions}<div class="acts">{@render actions()}</div>{/if}
</section>

<style>
  .stage {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-3) var(--sp-5);
    padding: var(--sp-4);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-top: 2px solid var(--c-accent);
    border-radius: var(--r-xs);
  }
  @media (min-width: 900px) {
    .stage {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    }
    .acts {
      grid-column: 1 / -1;
    }
  }
  .count {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .name {
    margin-top: 2px;
    font-size: var(--fs-2xl);
  }
  .state {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    margin-top: var(--sp-1);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .state.ok {
    color: var(--c-ok);
  }
  .slots {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    align-self: center;
  }
  .slots li {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-sm);
  }
  .box {
    display: grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    border: 1.5px solid var(--c-border-strong);
    border-radius: var(--r-xs);
    color: var(--c-on-accent);
  }
  .opt .box {
    border-style: dashed;
  }
  .done .box {
    background: var(--c-ok);
    border-color: var(--c-ok);
  }
  .slabel {
    font-weight: var(--fw-bold);
    white-space: nowrap;
  }
  .sm {
    overflow: hidden;
    color: var(--c-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--c-border);
  }
</style>
