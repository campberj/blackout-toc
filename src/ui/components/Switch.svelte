<script lang="ts">
  /* On/off toggle (role=switch). Visible text label states the current value, not just color. */
  interface Props {
    label: string;
    checked: boolean;
    disabled?: boolean;
    onchange: (next: boolean) => void;
  }

  let { label, checked, disabled = false, onchange }: Props = $props();
</script>

<button type="button" role="switch" class="switch" aria-checked={checked} aria-label={label} {disabled} onclick={() => onchange(!checked)}>
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  <span class="state">{checked ? 'On' : 'Off'}</span>
</button>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-2);
    border-radius: var(--r-sm);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    touch-action: manipulation;
  }
  .switch:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .switch:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .track {
    position: relative;
    width: 2.5rem;
    height: 1.375rem;
    border: 2px solid var(--c-border-strong);
    border-radius: var(--r-pill);
    background: var(--c-surface-2);
    transition: background-color var(--dur-fast) var(--ease);
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: var(--r-pill);
    background: var(--c-text-muted);
    transition: transform var(--dur-fast) var(--ease);
  }
  [aria-checked='true'] {
    color: var(--c-text);
  }
  [aria-checked='true'] .track {
    border-color: var(--c-accent);
    background: color-mix(in srgb, var(--c-accent) 30%, var(--c-surface-2));
  }
  [aria-checked='true'] .thumb {
    background: var(--c-accent);
    transform: translateX(1.125rem);
  }
  .state {
    min-width: 2.5ch;
  }
</style>
