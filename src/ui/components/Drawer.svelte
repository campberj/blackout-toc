<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  /*
   * Side sheet on native <dialog> (focus trap, Esc, inert page). Full-width on phones,
   * right-anchored panel from 640px. Focus returns to the opener on close.
   */
  interface Props {
    open?: boolean;
    title: string;
    /** Secondary line under the title. */
    subtitle?: string;
    actions?: Snippet;
    children: Snippet;
    onclose?: () => void;
  }

  let { open = $bindable(false), title, subtitle, actions, children, onclose }: Props = $props();
  const uid = $props.id();
  let el: HTMLDialogElement | undefined = $state();
  let opener: HTMLElement | null = null;

  $effect(() => {
    if (!el) return;
    if (open && !el.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  });

  function handleClose() {
    open = false;
    onclose?.();
    opener?.focus();
    opener = null;
  }
</script>

<dialog bind:this={el} class="drawer" aria-labelledby="{uid}-t" onclose={handleClose} onclick={(e) => e.target === el && (open = false)}>
  <div class="frame">
    <header class="head">
      <div class="titles">
        <h2 id="{uid}-t" class="title">{title}</h2>
        {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      </div>
      <IconButton icon="close" label="Close" onclick={() => (open = false)} />
    </header>
    <div class="body">{@render children()}</div>
    {#if actions}<footer class="foot">{@render actions()}</footer>{/if}
  </div>
</dialog>

<style>
  .drawer {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--c-border-strong);
    background: var(--c-surface-1);
    color: var(--c-text);
    box-shadow: var(--shadow-dialog);
  }
  @media (min-width: 640px) {
    .drawer {
      width: min(34rem, 92vw);
    }
  }
  .drawer::backdrop {
    background: var(--c-scrim);
  }
  .drawer[open] {
    animation: slide var(--dur-med) var(--ease);
  }
  .frame {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-2) var(--sp-3) var(--sp-5);
    border-bottom: 1px solid var(--c-border);
    border-top: 3px solid var(--c-accent);
  }
  .titles {
    padding-top: var(--sp-2);
    min-width: 0;
  }
  .title {
    font-size: var(--fs-xl);
  }
  .sub {
    margin-top: var(--sp-1);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-5);
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-5);
    border-top: 1px solid var(--c-border);
    background: var(--c-surface-2);
  }
  @keyframes slide {
    from {
      transform: translateX(24px);
      opacity: 0;
    }
  }
</style>
