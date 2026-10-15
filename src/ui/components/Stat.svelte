<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    size?: 'sm' | 'md' | 'lg';
  }

  let { label, value, size = 'md' }: Props = $props();
</script>

<div class="stat {size}">
  <dt class="label">{label}</dt>
  <dd class="value mono">{value}</dd>
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .label {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    letter-spacing: 0.02em;
  }
  .value {
    margin: 0;
    font-weight: var(--fw-bold);
    line-height: 1.1;
  }
  .sm .value {
    font-size: var(--fs-md);
  }
  .md .value {
    font-size: var(--fs-xl);
  }
  .lg .value {
    font-size: var(--fs-3xl);
  }
</style>
