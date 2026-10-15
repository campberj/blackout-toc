<script lang="ts">
  import { href } from '../router.svelte';

  interface Props {
    /** Current section, shown after the wordmark. */
    section: string;
  }
  let { section }: Props = $props();
</script>

<header class="header no-print">
  <a class="wordmark mono" href={href('/')} aria-label="BLKOUT TOC home">
    <span class="w-main">BLKOUT</span><span class="w-sep" aria-hidden="true">//</span><span class="w-sub">TOC</span>
  </a>
  <span class="section" aria-hidden="true">{section}</span>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    height: var(--header-h);
    padding: 0 var(--gutter);
    background: var(--c-surface-1);
    border-bottom: 1px solid var(--c-border);
  }
  .wordmark {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4ch;
    min-height: var(--touch);
    align-self: center;
    padding-block: var(--sp-2);
    color: var(--c-text);
    text-decoration: none;
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    letter-spacing: 0.06em;
  }
  .w-sep {
    color: var(--c-accent);
  }
  .w-sub {
    color: var(--c-text-muted);
  }
  .section {
    padding-left: var(--sp-4);
    border-left: 1px solid var(--c-border);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
