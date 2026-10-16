<script lang="ts">
  import Button from '../../components/Button.svelte';
  import { toasts } from '../../components/toast.svelte';
  import type { ChoiceView } from './model/choices';
  import type { CampaignSession } from './session.svelte';

  /* Decisions the engine is waiting on (e.g. where a replacement joins). */
  interface Props {
    choices: readonly ChoiceView[];
    session: CampaignSession;
  }
  let { choices, session }: Props = $props();

  async function resolve(c: ChoiceView, option: string, label: string) {
    const r = await session.run({ type: 'resolveChoice', choice: c.key, option });
    toasts.push(r.ok ? `${c.operatorName}: ${label}.` : r.error, r.ok ? 'ok' : 'crit');
  }
</script>

<section class="pending" aria-labelledby="pending-h">
  <h2 id="pending-h" class="h">Awaiting your decision</h2>
  {#each choices as c (c.key)}
    <div class="choice">
      <p class="prompt">{c.prompt}</p>
      <div class="opts">
        {#each c.options as o (o.value)}
          <Button variant={o.suggested ? 'primary' : o.value === 'discard' ? 'ghost' : 'secondary'} disabled={o.disabled || session.busy} title={o.reason ?? undefined} onclick={() => resolve(c, o.value, o.label)}>
            {o.label}
          </Button>
        {/each}
      </div>
      {#each c.options.filter((o) => o.reason) as o (o.value)}<p class="why">{o.reason}</p>{/each}
    </div>
  {/each}
</section>

<style>
  .pending {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    border: 1px solid color-mix(in srgb, var(--c-accent) 60%, transparent);
    border-left: 4px solid var(--c-accent);
    border-radius: var(--r-xs);
    background: color-mix(in srgb, var(--c-accent) 7%, var(--c-surface-1));
  }
  .h {
    font-size: var(--fs-md);
  }
  .choice {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .why {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
</style>
