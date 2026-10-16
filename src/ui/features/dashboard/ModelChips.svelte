<script lang="ts">
  import type { ModelState, UnitState } from '$lib/app';
  import { damageSummary, STATUS_META } from './board';

  /* One tappable chip per model: status, tokens, kills and damage at a glance. */
  interface Props {
    unit: UnitState;
    onpick: (model: ModelState) => void;
  }

  let { unit, onpick }: Props = $props();
</script>

<ul class="chips" role="list" aria-label="{unit.name} models">
  {#each unit.models as m (m.key)}
    {@const meta = STATUS_META[m.status]}
    {@const dmg = damageSummary(unit, m)}
    <li>
      <button type="button" class="chip st-{meta.tone}" class:out={m.status !== 'active' && m.status !== 'embarked'} onclick={() => onpick(m)}>
        <span class="name">{m.name}</span>
        <span class="meta">
          {#if m.status !== 'active'}<span class="status">{meta.label}</span>{/if}
          {#if m.ready}<span class="tok" title="Ready">R</span>{/if}
          {#if m.engaged}<span class="tok eng" title="Engaged">E</span>{/if}
          {#if dmg}<span class="dmg mono" title="Damage">{dmg}</span>{/if}
          {#if m.kills > 0}<span class="kills mono" title="Kills">✕{m.kills}</span>{/if}
        </span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .chip {
    --tone: var(--c-ok);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
    min-width: 6.5rem;
    min-height: var(--touch-lg);
    padding: var(--sp-1) var(--sp-3) var(--sp-1) var(--sp-3);
    border: 1px solid var(--c-border-strong);
    border-left: 4px solid var(--tone);
    border-radius: var(--r-sm);
    background: var(--c-surface-2);
    color: var(--c-text);
    text-align: left;
    touch-action: manipulation;
  }
  .chip:hover {
    background: var(--c-surface-3);
  }
  .chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .st-warn {
    --tone: var(--c-warn);
  }
  .st-crit {
    --tone: var(--c-crit);
  }
  .st-info {
    --tone: var(--c-info);
  }
  .st-neutral {
    --tone: var(--c-neutral);
  }
  .out .name {
    color: var(--c-text-muted);
  }
  .st-crit.out .name {
    text-decoration: line-through;
    text-decoration-color: var(--c-crit);
  }
  .name {
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    line-height: 1.2;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    min-height: 1rem;
  }
  .status {
    color: var(--tone);
    font-weight: var(--fw-bold);
  }
  .tok {
    padding: 0 4px;
    border: 1px solid var(--c-info);
    border-radius: var(--r-xs);
    color: var(--c-info);
    font-weight: var(--fw-bold);
  }
  .tok.eng {
    border-color: var(--c-warn);
    color: var(--c-warn);
  }
  .dmg {
    color: var(--c-crit);
  }
  .kills {
    color: var(--c-accent);
    font-weight: var(--fw-bold);
  }
</style>
