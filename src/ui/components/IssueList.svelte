<script lang="ts">
  import type { ValidationIssue } from '../../app';
  import Icon from './Icon.svelte';

  /* Validation summary: errors first, glyph + text per row (never color alone). */
  interface Props {
    issues: readonly ValidationIssue[];
    /** Shown when there are no issues; omit to render nothing. */
    okMessage?: string;
    /** Prefix each row with its field path. */
    showPath?: boolean;
  }

  let { issues, okMessage, showPath = false }: Props = $props();
  const sorted = $derived([...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1)));
</script>

{#if sorted.length > 0}
  <ul class="issues" role="list" aria-label="Validation issues">
    {#each sorted as it, i (i)}
      <li class={it.severity}>
        <Icon name={it.severity === 'error' ? 'alert' : 'info'} size={16} />
        <span class="sev">{it.severity === 'error' ? 'Error' : 'Warning'}</span>
        <span class="msg">{#if showPath && it.path}<span class="path mono">{it.path}</span>{/if}{it.message}</span>
      </li>
    {/each}
  </ul>
{:else if okMessage}
  <p class="ok"><Icon name="check" size={16} />{okMessage}</p>
{/if}

<style>
  .issues {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  li {
    --tone: var(--c-warn);
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: baseline;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--tone);
    background: color-mix(in srgb, var(--tone) 8%, transparent);
    font-size: var(--fs-sm);
  }
  li :global(svg) {
    color: var(--tone);
    align-self: center;
  }
  .error {
    --tone: var(--c-crit);
  }
  .sev {
    color: var(--tone);
    font-weight: var(--fw-bold);
  }
  .path {
    margin-right: var(--sp-2);
    color: var(--c-text-muted);
  }
  .ok {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-ok);
    font-size: var(--fs-sm);
  }
</style>
