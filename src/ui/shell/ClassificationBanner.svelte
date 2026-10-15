<script lang="ts">
  // Parody marking, deliberately not a real classification.
  interface Props {
    text?: string;
  }
  let { text = 'UNCLASSIFIED // FAN TOOL' }: Props = $props();
</script>

<div class="banner no-print" role="note" aria-label="Unofficial fan tool">
  <span class="mono">{text}</span>
</div>

<style>
  .banner {
    display: grid;
    place-items: center;
    height: var(--banner-h);
    background: var(--c-banner-bg);
    color: var(--c-banner-text);
    font-size: var(--fs-xs);
    font-weight: var(--fw-bold);
    letter-spacing: 0.14em;
    border-bottom: 1px solid color-mix(in srgb, var(--c-banner-text) 30%, transparent);
  }
</style>
