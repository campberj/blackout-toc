<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { href, type RoutePath } from '../router.svelte';
  import type { NavItem } from '../nav';

  /* One nav, two layouts: bottom tab bar (portrait / phone) or side rail (landscape / desktop). */
  interface Props {
    items: readonly NavItem[];
    current: RoutePath;
  }
  let { items, current }: Props = $props();
</script>

<nav class="nav" aria-label="Main">
  <ul role="list">
    {#each items as item (item.path)}
      <li>
        <a href={href(item.path)} aria-current={item.path === current ? 'page' : undefined}>
          <Icon name={item.icon} size={22} />
          <span class="lbl">{item.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .nav {
    background: var(--c-surface-1);
  }
  ul {
    display: flex;
    height: 100%;
  }
  li {
    flex: 1 1 0;
    min-width: 0;
  }
  a {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 100%;
    min-height: var(--touch);
    padding: var(--sp-1) 2px;
    color: var(--c-text-muted);
    text-decoration: none;
    font-size: 0.6875rem;
    font-weight: var(--fw-medium);
    touch-action: manipulation;
  }
  a:hover {
    color: var(--c-text);
    background: var(--c-surface-2);
  }
  a:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: -3px;
  }
  a[aria-current='page'] {
    color: var(--c-accent);
  }
  /* Active indicator: top bar in tab mode, left bar in rail mode. */
  a[aria-current='page']::before {
    content: '';
    position: absolute;
    background: var(--c-accent);
    inset: 0 20% auto;
    height: 3px;
  }
  .lbl {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (orientation: landscape) and (min-width: 768px), (min-width: 1024px) {
    ul {
      flex-direction: column;
      gap: var(--sp-1);
      padding: var(--sp-3) 0;
    }
    li {
      flex: none;
    }
    a {
      height: auto;
      min-height: 4rem;
      font-size: var(--fs-xs);
    }
    a[aria-current='page'] {
      background: var(--c-surface-2);
    }
    a[aria-current='page']::before {
      inset: 18% auto 18% 0;
      width: 3px;
      height: auto;
    }
    /* Settings sits at the bottom of the rail. */
    li:last-child {
      margin-top: auto;
    }
  }
</style>
