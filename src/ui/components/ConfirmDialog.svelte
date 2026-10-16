<script lang="ts">
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  /* Destructive-action confirm on top of Dialog. The confirm label names the action ("Delete roster"). */
  interface Props {
    open?: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onconfirm: () => void;
  }

  let { open = $bindable(false), title, message, confirmLabel, onconfirm }: Props = $props();
</script>

<Dialog bind:open {title}>
  <p>{message}</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        open = false;
        onconfirm();
      }}>{confirmLabel}</Button
    >
  {/snippet}
</Dialog>
