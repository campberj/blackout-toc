<script lang="ts">
  import type { Campaign } from '$lib/packs/schema';
  import type { CampaignState } from '$lib/domain/campaign';
  import SegmentMeter from '../../components/SegmentMeter.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import { assetViews, flagViews, poolViews, trackViews } from './model/tracks';
  import { campaignBadges } from './model/ladders';

  /* Tracks (segmented meters), pools, held assets, raised flags. */
  interface Props {
    campaign: Campaign;
    cs: CampaignState;
  }
  let { campaign, cs }: Props = $props();
  const tracks = $derived(trackViews(campaign, cs));
  const pools = $derived(poolViews(campaign, cs));
  const assets = $derived(assetViews(campaign, cs));
  const flags = $derived(flagViews(cs));
  const ladders = $derived(campaignBadges(campaign, cs));
  const milestoneName = (k: string) => k.replace(/-/g, ' ');
</script>

<section class="board" aria-label="Campaign status">
  {#if tracks.length}
    <div class="tracks">
      {#each tracks as t (t.key)}
        <SegmentMeter
          label={t.name}
          value={t.value}
          min={t.min}
          max={t.max}
          ticks={t.ticks.map((m) => ({ pos: m.pos, at: m.at, label: milestoneName(m.key), reached: m.reached }))}
          caption={t.next ? `Next milestone at ${t.next.at}` : t.ticks.length ? 'All milestones reached' : undefined}
        />
      {/each}
    </div>
  {/if}
  {#if pools.length || ladders.length}
    <dl class="pools">
      {#each pools as p (p.key)}
        <div><dt>{p.name}</dt><dd class="mono">{p.value}{#if p.max !== null}<span class="of">/{p.max}</span>{/if}</dd></div>
      {/each}
      {#each ladders as l (l.ladder)}
        <div><dt>{l.ladderName}</dt><dd><StatusBadge status={l.tone} label={l.label} /></dd></div>
      {/each}
    </dl>
  {/if}
  {#if assets.length}
    <div class="assets">
      <h3 class="sub">Assets</h3>
      <ul role="list">
        {#each assets as a (a.key + (a.team ?? ''))}
          <li title={a.text ?? undefined}>{a.name}{#if a.count > 1}<span class="mono"> ×{a.count}</span>{/if}{#if a.team}<span class="team"> ({a.team})</span>{/if}</li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if flags.length}
    <div class="assets">
      <h3 class="sub">Flags</h3>
      <ul role="list">{#each flags as f (f.key)}<li>{f.label}{#if f.value !== 'Yes'}: <span class="mono">{f.value}</span>{/if}</li>{/each}</ul>
    </div>
  {/if}
</section>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-4);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xs);
  }
  .tracks {
    display: grid;
    gap: var(--sp-4) var(--sp-5);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  }
  .pools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3) var(--sp-6);
  }
  .pools dt {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }
  .pools dd {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
  }
  .of {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-regular);
  }
  .sub {
    margin-bottom: var(--sp-1);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
  }
  .assets ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1) var(--sp-4);
    font-size: var(--fs-sm);
  }
  .team {
    color: var(--c-text-muted);
  }
</style>
