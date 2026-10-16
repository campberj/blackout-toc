<script lang="ts">
  import type { SessionSummary } from '$lib/app';
  import type { Roster } from '$lib/domain/roster';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Panel from '../../components/Panel.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import { toasts } from '../../components/toast.svelte';
  import Page from '../../shell/Page.svelte';
  import { href, router } from '../../router.svelte';
  import { useAppState } from '../../state/app-context.svelte';

  /* Games list + new game (roster + optional scenario). Campaign games arrive via the campaign UI. */
  const app = useAppState();

  let sessions = $state<SessionSummary[] | null>(null);
  let rosters = $state<Roster[]>([]);
  const scenarios = $derived(app.registry?.list('scenario') ?? []);

  let rosterId = $state('');
  let scenarioId = $state('');
  let name = $state('');
  let creating = $state(false);
  let removing = $state<SessionSummary | null>(null);
  let removeOpen = $state(false);

  async function refresh() {
    const ctx = app.ctx;
    [sessions, rosters] = await Promise.all([ctx.sessions.list(), ctx.rosters.list()]);
    if (!rosterId && rosters[0]) rosterId = rosters[0].id;
  }
  $effect(() => {
    if (app.status === 'ready') void refresh();
  });

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!rosterId) return;
    creating = true;
    const r = await app.ctx.sessions.create({ rosterId, ...(scenarioId ? { scenarioId: scenarioId as never } : {}), ...(name.trim() ? { name: name.trim() } : {}) });
    creating = false;
    if (!r.ok) return void toasts.push(r.error, 'crit');
    if (r.value.missing.length) toasts.push(`Skipped cards that are not loaded: ${r.value.missing.join(', ')}`, 'warn', 8000);
    router.go('/dashboard', { session: r.value.record.id });
  }

  async function confirmRemove() {
    if (!removing) return;
    await app.ctx.sessions.remove(removing.id);
    toasts.push(`Deleted ${removing.name}`, 'ok');
    removeOpen = false;
    removing = null;
    await refresh();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<Page title="Game" purpose="Track the round, command points, objectives and every unit's status during play.">
  <div class="layout">
    <Panel title="New game" level={2}>
      {#if app.status !== 'ready'}
        <p class="muted">Loading…</p>
      {:else if rosters.length === 0}
        <EmptyState title="Build a roster first" message="A game starts from a saved roster. Campaign missions open their own games." icon="roster">
          {#snippet action()}<Button variant="primary" onclick={() => router.go('/roster')}>Open roster builder</Button>{/snippet}
        </EmptyState>
      {:else}
        <form class="form" onsubmit={create}>
          <Field label="Roster" required>
            {#snippet control(a)}
              <select class="control" {...a} bind:value={rosterId}>
                {#each rosters as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
              </select>
            {/snippet}
          </Field>
          <Field label="Scenario" hint="Optional. Brings its objectives, special rules and fixed OPFOR.">
            {#snippet control(a)}
              <select class="control" {...a} bind:value={scenarioId}>
                <option value="">No scenario</option>
                {#each scenarios as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
              </select>
            {/snippet}
          </Field>
          <Field label="Game name" hint="Defaults to the roster name.">
            {#snippet control(a)}<input class="control" {...a} bind:value={name} maxlength="80" />{/snippet}
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={!rosterId || creating}>Start game</Button>
        </form>
      {/if}
    </Panel>

    <section class="games" aria-labelledby="games-h">
      <h2 id="games-h" class="h">Games</h2>
      {#if sessions === null}
        <p class="muted">Loading…</p>
      {:else if sessions.length === 0}
        <EmptyState title="No games yet" message="Start one from a roster, or launch a mission from your campaign." icon="dashboard" />
      {:else}
        <ul class="list" role="list">
          {#each sessions as s (s.id)}
            <li class="row">
              <a class="open" href={href('/dashboard', { session: s.id })}>
                <span class="g-name">{s.name}</span>
                <span class="g-meta">
                  {#if s.ended}<StatusBadge status="neutral" label="Ended" />{:else}<StatusBadge status="ok" label="Round {s.round} of {s.roundLimit}" />{/if}
                  {#if s.link}<StatusBadge status="info" label="Campaign" />{/if}
                  {#if s.scenarioName}<span>{s.scenarioName}</span>{/if}
                  <span class="when">{fmt(s.lastAt ?? s.createdAt)}</span>
                </span>
              </a>
              <Button
                variant="ghost"
                onclick={() => {
                  removing = s;
                  removeOpen = true;
                }}
                aria-label="Delete {s.name}">Delete</Button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</Page>

<Dialog bind:open={removeOpen} title="Delete this game?">
  <p>{removing?.name} and its log will be deleted. This cannot be undone.</p>
  {#snippet actions()}
    <Button onclick={() => (removeOpen = false)}>Cancel</Button>
    <Button variant="danger" onclick={confirmRemove}>Delete game</Button>
  {/snippet}
</Dialog>

<style>
  .layout {
    display: grid;
    gap: var(--sp-5);
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 1000px) {
    .layout {
      grid-template-columns: minmax(20rem, 1fr) minmax(0, 1.4fr);
      align-items: start;
    }
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .muted {
    color: var(--c-text-muted);
  }
  .games {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .h {
    font-size: var(--fs-lg);
  }
  .list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
    background: var(--c-surface-1);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-right: var(--sp-2);
  }
  .row + .row {
    border-top: 1px solid var(--c-border);
  }
  .open {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    min-height: var(--touch-lg);
    padding: var(--sp-3) var(--sp-4);
    color: var(--c-text);
    text-decoration: none;
  }
  .open:hover {
    background: var(--c-surface-2);
  }
  .open:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--c-accent);
  }
  .g-name {
    font-weight: var(--fw-bold);
    font-size: var(--fs-lg);
  }
  .g-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .when {
    margin-left: auto;
  }
</style>
