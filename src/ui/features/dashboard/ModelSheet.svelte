<script lang="ts">
  import { MODEL_STATUSES, type ModelStatus } from '$lib/app';
  import Dialog from '../../components/Dialog.svelte';
  import Button from '../../components/Button.svelte';
  import PipTrack from '../../components/PipTrack.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import ToggleChip from '../../components/ToggleChip.svelte';
  import type { BoardController } from './board.svelte';
  import { STATUS_META } from './board';

  /* Everything you can do to one model, in one sheet. Changes apply immediately. */
  interface Props {
    board: BoardController;
    unitKey: string | null;
    modelKey: string | null;
    onclose: () => void;
  }

  let { board, unitKey, modelKey, onclose }: Props = $props();

  const unit = $derived(board.state?.units.find((u) => u.key === unitKey) ?? null);
  const model = $derived(unit?.models.find((m) => m.key === modelKey) ?? null);
  let open = $derived(model !== null);

  const statusOptions = MODEL_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }));

  function run(cmd: Parameters<BoardController['run']>[0]) {
    void board.run(cmd);
  }
</script>

<Dialog bind:open title={model ? model.name : 'Model'} {onclose}>
  {#if unit && model}
    {#key board.rev}
      <div class="sheet">
        <p class="sub">
          {unit.name}{#if model.operatorKey}<span class="op">Campaign operator</span>{/if}
        </p>

        <section class="row" aria-label="Status">
          <h3 class="h">Status</h3>
          <Segmented
            label="{model.name} status"
            options={statusOptions}
            value={model.status}
            wrap
            onchange={(status: ModelStatus) => run({ type: 'setModelStatus', unit: unit.key, model: model.key, status })}
          />
        </section>

        <section class="row two" aria-label="Tokens and kills">
          <div>
            <h3 class="h">Tokens</h3>
            <div class="chips">
              <ToggleChip label="Ready" tone="info" pressed={model.ready} ontoggle={(value) => run({ type: 'setToken', unit: unit.key, model: model.key, token: 'ready', value })} />
              <ToggleChip label="Engaged" tone="warn" pressed={model.engaged} ontoggle={(value) => run({ type: 'setToken', unit: unit.key, model: model.key, token: 'engaged', value })} />
            </div>
          </div>
          <div>
            <h3 class="h">Kills credited</h3>
            <Stepper label="{model.name} kills" value={model.kills} atMin={model.kills === 0} size="lg" onstep={(delta) => run({ type: 'creditKill', unit: unit.key, model: model.key, delta })} />
          </div>
        </section>

        {#if unit.tracks.length > 0}
          <section class="row" aria-label="Damage">
            <h3 class="h">Damage</h3>
            {#each unit.tracks as t (t.key)}
              <div class="track">
                <span>{t.name}</span>
                <PipTrack
                  label="{model.name} {t.name}"
                  max={t.size}
                  shape="box"
                  tone="crit"
                  value={model.damage[t.key] ?? 0}
                  onchange={(marked) => run({ type: 'setDamage', unit: unit.key, model: model.key, track: t.key, marked })}
                />
              </div>
            {/each}
          </section>
        {/if}
      </div>
    {/key}
  {/if}
  {#snippet actions()}
    <Button variant="primary" onclick={() => (open = false)}>Done</Button>
  {/snippet}
</Dialog>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .sub {
    margin-top: calc(-1 * var(--sp-2));
    color: var(--c-text-muted);
  }
  .op {
    margin-left: var(--sp-2);
    padding: 1px var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
    font-size: var(--fs-xs);
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--sp-4);
  }
  .two > div {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .h {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .track {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
  }
</style>
