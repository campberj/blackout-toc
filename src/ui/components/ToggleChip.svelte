<script lang="ts">
  /* Pressable token (Activated, Pinned, Ready…). Stateless: `pressed` in, `ontoggle` out. */
  interface Props {
    label: string;
    pressed: boolean;
    /** Longer accessible name when the visible label is terse. */
    title?: string;
    tone?: 'accent' | 'warn' | 'info' | 'crit';
    disabled?: boolean;
    ontoggle: (next: boolean) => void;
  }

  let { label, pressed, title, tone = 'accent', disabled = false, ontoggle }: Props = $props();
</script>

<button type="button" class="chip tone-{tone}" aria-pressed={pressed} aria-label={title} {title} {disabled} onclick={() => ontoggle(!pressed)}>
  <span class="box" aria-hidden="true"></span>{label}
</button>

<style>
  .chip {
    --tone: var(--c-accent);
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    background: var(--c-surface-2);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    white-space: nowrap;
    touch-action: manipulation;
  }
  .tone-warn {
    --tone: var(--c-warn);
  }
  .tone-info {
    --tone: var(--c-info);
  }
  .tone-crit {
    --tone: var(--c-crit);
  }
  .box {
    width: 0.85rem;
    height: 0.85rem;
    border: 2px solid currentColor;
    border-radius: var(--r-xs);
  }
  .chip[aria-pressed='true'] {
    border-color: var(--tone);
    background: color-mix(in srgb, var(--tone) 18%, var(--c-surface-2));
    color: var(--c-text);
  }
  .chip[aria-pressed='true'] .box {
    border-color: var(--tone);
    background: var(--tone);
  }
  .chip:not(:disabled):hover {
    background: var(--c-surface-3);
  }
  .chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .chip:disabled {
    opacity: 0.45;
  }
</style>
