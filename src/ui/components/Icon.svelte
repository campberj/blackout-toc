<script lang="ts">
  import { ICONS, type IconName } from './icons';

  interface Props {
    name: IconName;
    size?: number;
    /** Omit for decorative icons (hidden from AT). */
    label?: string;
  }

  let { name, size = 22, label }: Props = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  <path d={ICONS[name]} />
</svg>

<style>
  .icon {
    flex: none;
  }
</style>
