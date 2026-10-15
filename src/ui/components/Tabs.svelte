<script lang="ts" module>
  export interface TabItem {
    id: string;
    label: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /* WAI-ARIA tabs (automatic activation). The panel snippet receives the selected id. */
  interface Props {
    label: string;
    tabs: readonly TabItem[];
    selected?: string;
    panel: Snippet<[string]>;
  }

  let { label, tabs, selected = $bindable(tabs[0]?.id ?? ''), panel }: Props = $props();

  const uid = $props.id();
  let tabEls: HTMLButtonElement[] = $state([]);

  function onkeydown(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === selected);
    const last = tabs.length - 1;
    const map: Record<string, number> = {
      ArrowRight: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1,
      Home: 0,
      End: last,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = tabs[next];
    if (!t) return;
    selected = t.id;
    tabEls[next]?.focus();
  }
</script>

<div class="tabs">
  <div class="list" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
    {#each tabs as t, i (t.id)}
      <button
        bind:this={tabEls[i]}
        type="button"
        role="tab"
        id="{uid}-t-{t.id}"
        aria-selected={t.id === selected}
        aria-controls="{uid}-p"
        tabindex={t.id === selected ? 0 : -1}
        onclick={() => (selected = t.id)}
      >
        {t.label}
      </button>
    {/each}
  </div>
  <div class="panel" role="tabpanel" id="{uid}-p" aria-labelledby="{uid}-t-{selected}" tabindex="0">
    {@render panel(selected)}
  </div>
</div>

<style>
  .list {
    display: flex;
    gap: var(--sp-1);
    overflow-x: auto;
    border-bottom: 1px solid var(--c-border);
    scrollbar-width: thin;
  }
  .list:focus {
    outline: none;
  }
  [role='tab'] {
    position: relative;
    min-height: var(--touch);
    padding: 0 var(--sp-4);
    color: var(--c-text-muted);
    font-weight: var(--fw-medium);
    white-space: nowrap;
  }
  [role='tab']:hover {
    color: var(--c-text);
  }
  [role='tab'][aria-selected='true'] {
    color: var(--c-text);
  }
  [role='tab'][aria-selected='true']::after {
    content: '';
    position: absolute;
    inset: auto var(--sp-2) -1px;
    height: 3px;
    background: var(--c-accent);
  }
  [role='tab']:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: -2px;
  }
  .panel {
    padding-top: var(--sp-4);
  }
  .panel:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
  }
</style>
