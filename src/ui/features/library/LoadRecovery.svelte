<script lang="ts">
  import { formatLoadError, type LibraryError, type PackInfo } from '../../../app';
  import { useAppState } from '../../state/app-context.svelte';
  import { toasts } from '../../components/toast.svelte';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import { failingPacks } from './library-model';

  /* Shown when the enabled pack set fails to load (registry is empty): name the culprits, one tap to disable. */
  interface Props {
    errors: readonly LibraryError[];
    packs: readonly PackInfo[];
    refresh: () => Promise<void>;
  }

  let { errors, packs, refresh }: Props = $props();
  const app = useAppState();
  const suspects = $derived(failingPacks(errors, packs));
  let blocked = $state<string[]>([]);

  async function disable(p: PackInfo) {
    const r = await app.ctx.library.setEnabled(p.id, false);
    blocked = r.ok ? [] : r.error.map(formatLoadError);
    if (r.ok) toasts.push(r.value.errors.length ? `${p.title ?? p.id} disabled; other packs still fail` : `${p.title ?? p.id} disabled. Content is back.`, 'ok');
    await refresh();
  }
</script>

<section class="recovery" aria-labelledby="recovery-h" role="alert">
  <h2 id="recovery-h" class="title"><Icon name="alert" size={20} />Packs failed to load</h2>
  <p>No cards, rulesets or campaigns are available until the problem is fixed. Disable the pack below, then re-import a corrected version.</p>
  <ul class="errs" role="list">
    {#each errors as e, i (i)}<li class="mono">{formatLoadError(e)}</li>{/each}
  </ul>
  <div class="cluster">
    {#each suspects as p (p.id)}
      <Button variant="primary" onclick={() => disable(p)}>Disable {p.title ?? p.id}</Button>
    {/each}
  </div>
  {#each blocked as b, i (i)}<p class="mono blocked">{b}</p>{/each}
</section>

<style>
  .recovery {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    border: 1px solid var(--c-crit);
    border-left-width: 4px;
    background: color-mix(in srgb, var(--c-crit) 8%, var(--c-surface-1));
  }
  .title {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-lg);
    color: var(--c-crit);
  }
  .errs {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    font-size: var(--fs-sm);
    overflow-wrap: anywhere;
  }
  .blocked {
    color: var(--c-crit);
    font-size: var(--fs-sm);
  }
</style>
