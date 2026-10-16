<script lang="ts">
  import type { LibrarySnapshot, ValidationIssue } from '../../../app';
  import type { Id, RosterMode } from '$lib/packs/schema';
  import { fieldMessage, issuesAt } from '../../components/issues';
  import IconButton from '../../components/IconButton.svelte';
  import IssueList from '../../components/IssueList.svelte';
  import IdSelect from './IdSelect.svelte';
  import { byFaction, handlerRule, withOptional, type RosterGroupDraft, type UnitOptions } from './roster-form';

  interface Props {
    group: RosterGroupDraft;
    index: number;
    lookup: LibrarySnapshot['registry'];
    options: UnitOptions;
    mode: RosterMode | undefined;
    issues: readonly ValidationIssue[];
    onchange: (next: RosterGroupDraft) => void;
    onremove?: (() => void) | undefined;
  }

  let { group, index, lookup, options, mode, issues, onchange, onremove }: Props = $props();

  const base = $derived(`groups.${index}`);
  const faction = $derived(group.forceCardId ? lookup.get('force', group.forceCardId)?.faction : undefined);
  const rule = $derived(handlerRule(mode));
  const unitName = (id: string) => lookup.get('unit', id as Id)?.name ?? `Missing: ${id}`;

  function addUnit(id: string) {
    if (id) onchange({ ...group, unitIds: [...group.unitIds, id as Id] });
  }
  function removeUnit(i: number) {
    onchange({ ...group, unitIds: group.unitIds.filter((_, j) => j !== i) });
  }
</script>

<section class="group" aria-labelledby="{base}-h">
  <header class="gh">
    <h3 id="{base}-h" class="gt">Group {index + 1}</h3>
    {#if onremove}<IconButton icon="trash" label="Remove group {index + 1}" onclick={onremove} />{/if}
  </header>

  <div class="fields">
    <IdSelect
      label="Force card"
      none="No force card"
      value={group.forceCardId}
      groups={byFaction(lookup, options.forces)}
      required={(mode?.forceCardsPerGroup.min ?? 0) > 0}
      error={fieldMessage(issues, `${base}.forceCardId`)}
      onchange={(id) => onchange(withOptional(group, 'forceCardId', id as Id))}
    />
    {#if rule !== 'forbidden'}
      <IdSelect
        label="Handler"
        none="No handler"
        hint={rule === 'required' ? 'One handler per group' : 'Optional, at most one'}
        value={group.handlerId}
        groups={byFaction(lookup, options.handlers, faction)}
        required={rule === 'required'}
        error={fieldMessage(issues, `${base}.handlerId`)}
        onchange={(id) => onchange(withOptional(group, 'handlerId', id as Id))}
      />
    {/if}
  </div>

  <div class="units">
    <p class="ut">Units</p>
    {#if group.unitIds.length > 0}
      <ol class="ulist">
        {#each group.unitIds as id, i (`${id}-${i}`)}
          {@const msg = fieldMessage(issues, `${base}.unitIds.${i}`)}
          <li class:bad={!!msg}>
            <span class="un">{unitName(id)}</span>
            {#if msg}<span class="ue">{msg}</span>{/if}
            <IconButton icon="close" label="Remove {unitName(id)}" onclick={() => removeUnit(i)} />
          </li>
        {/each}
      </ol>
    {/if}
    <IdSelect
      label="Add unit"
      none="Choose a unit to add…"
      value=""
      groups={byFaction(lookup, options.units, faction)}
      error={fieldMessage(issues, `${base}.unitIds`)}
      onchange={addUnit}
    />
  </div>
  <IssueList issues={issuesAt(issues, base)} />
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-top: 2px solid var(--c-border-strong);
  }
  .gh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--touch);
  }
  .gt {
    font-size: var(--fs-md);
  }
  .fields {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  }
  .units {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .ut {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .ulist {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0;
    list-style: none;
    counter-reset: u;
  }
  .ulist li {
    display: grid;
    grid-template-columns: 2ch 1fr auto;
    align-items: center;
    gap: var(--sp-2);
    padding-left: var(--sp-3);
    background: var(--c-surface-2);
    border-left: 3px solid var(--c-border-strong);
    counter-increment: u;
  }
  .ulist li::before {
    content: counter(u);
    color: var(--c-text-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .ulist li.bad {
    border-left-color: var(--c-crit);
  }
  .un {
    font-weight: var(--fw-medium);
  }
  .ue {
    grid-column: 2;
    color: var(--c-crit);
    font-size: var(--fs-sm);
  }
  .bad :global(.icon-btn) {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
  .bad::before {
    grid-row: 1 / span 2;
  }
</style>
