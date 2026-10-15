<script lang="ts">
  import IconButton from './IconButton.svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import { toasts, type ToastTone } from './toast.svelte';

  const GLYPH: Record<ToastTone, IconName> = { ok: 'check', warn: 'alert', crit: 'alert', info: 'info' };
</script>

<!-- Polite live region; crit toasts are still announced politely to avoid interrupting play. -->
<div class="host" role="status" aria-live="polite">
  {#each toasts.items as t (t.id)}
    <div class="toast {t.tone}">
      <Icon name={GLYPH[t.tone]} size={18} />
      <p class="msg">{t.message}</p>
      <IconButton icon="close" label="Dismiss" onclick={() => toasts.dismiss(t.id)} />
    </div>
  {/each}
</div>

<style>
  .host {
    position: fixed;
    z-index: 50;
    inset-inline: var(--gutter);
    bottom: calc(var(--tabbar-h) + var(--sp-3) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    pointer-events: none;
  }
  @media (orientation: landscape) and (min-width: 768px), (min-width: 1024px) {
    .host {
      bottom: var(--sp-5);
      align-items: flex-end;
    }
  }
  .toast {
    --tone: var(--c-info);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: min(28rem, 100%);
    padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-4);
    background: var(--c-surface-3);
    border: 1px solid var(--c-border-strong);
    border-left: 4px solid var(--tone);
    border-radius: var(--r-sm);
    box-shadow: var(--shadow-dialog);
    color: var(--c-text);
    animation: in var(--dur-med) var(--ease);
  }
  .toast :global(svg:first-child) {
    color: var(--tone);
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
  .msg {
    flex: 1;
    font-size: var(--fs-sm);
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
