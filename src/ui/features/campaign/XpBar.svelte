<script lang="ts">
  import type { XpProgress } from './model/xp';

  interface Props {
    xp: XpProgress;
  }
  let { xp }: Props = $props();
  const text = $derived(xp.next ? `${xp.xp}/${xp.next.xp} XP to ${xp.next.name}` : `${xp.xp} XP, top rank`);
</script>

<div class="xp" role="img" aria-label={text}>
  <span class="bar"><span class="fill" style:width="{xp.ratio * 100}%"></span></span>
  <span class="t mono">{text}</span>
</div>

<style>
  .xp {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 8rem;
  }
  .bar {
    display: block;
    height: 0.375rem;
    background: var(--c-surface-3);
    border: 1px solid var(--c-border);
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--c-accent);
  }
  .t {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
</style>
