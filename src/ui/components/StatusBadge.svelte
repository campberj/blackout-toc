<script lang="ts" module>
  export type Status = 'ok' | 'warn' | 'crit' | 'info' | 'neutral';
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    status: Status;
    label: string;
  }

  let { status, label }: Props = $props();

  // Glyph + text so status never depends on color alone.
  const GLYPH: Record<Status, IconName> = { ok: 'check', warn: 'alert', crit: 'alert', info: 'info', neutral: 'dot' };
</script>

<span class="badge {status}">
  <Icon name={GLYPH[status]} size={14} />
  <span>{label}</span>
</span>

<style>
  .badge {
    --tone: var(--c-neutral);
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    padding: 2px var(--sp-2);
    border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
    border-radius: var(--r-sm);
    background: color-mix(in srgb, var(--tone) 12%, transparent);
    color: var(--tone);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
    line-height: 1.4;
    white-space: nowrap;
  }
  .ok {
    --tone: var(--c-ok);
  }
  .warn {
    --tone: var(--c-warn);
  }
  .crit {
    --tone: var(--c-crit);
  }
  .info {
    --tone: var(--c-info);
  }
</style>
