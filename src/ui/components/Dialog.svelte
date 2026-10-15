<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  /*
   * Native <dialog> via showModal(): browser supplies focus trap, inert
   * background, Esc and top-layer. We restore focus to the opener on close.
   */
  interface Props {
    open?: boolean;
    title: string;
    /** Footer actions (buttons). */
    actions?: Snippet;
    children: Snippet;
    onclose?: () => void;
  }

  let { open = $bindable(false), title, actions, children, onclose }: Props = $props();

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

  // Click on the backdrop (the dialog box itself, outside .frame) closes.
  function onclick(e: MouseEvent) {
    if (e.target === el) open = false;
  }
</script>

<dialog bind:this={el} class="dialog" aria-labelledby="{uid}-t" onclose={handleClose} {onclick}>
  <div class="frame">
    <header class="head">
      <h2 id="{uid}-t" class="title">{title}</h2>
      <IconButton icon="close" label="Close" onclick={() => (open = false)} />
    </header>
    <div class="body">
      {@render children()}
    </div>
    {#if actions}
      <footer class="foot">{@render actions()}</footer>
    {/if}
  </div>
</dialog>

<style>
  .dialog {
    width: min(36rem, calc(100vw - 2 * var(--sp-4)));
    max-height: calc(100dvh - 2 * var(--sp-6));
    padding: 0;
    margin: auto;
    border: 1px solid var(--c-border-strong);
    border-top: 3px solid var(--c-accent);
    border-radius: var(--r-sm);
    background: var(--c-surface-1);
    color: var(--c-text);
    box-shadow: var(--shadow-dialog);
  }
  .dialog::backdrop {
    background: var(--c-scrim);
  }
  .dialog[open] {
    animation: rise var(--dur-med) var(--ease);
  }
  .frame {
    display: flex;
    flex-direction: column;
    max-height: inherit;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-5);
    border-bottom: 1px solid var(--c-border);
  }
  .title {
    font-size: var(--fs-lg);
  }
  .body {
    padding: var(--sp-5);
    overflow-y: auto;
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
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
</style>
