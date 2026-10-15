<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import { href } from '../../router.svelte';
  import { NAV_ITEMS } from '../../nav';

  // Home = launcher. Purpose lines double as the feature map until real status lands.
  const PURPOSE: Record<string, string> = {
    '/dashboard': 'Track a game in progress',
    '/campaign': 'Run your solo campaign',
    '/roster': 'Build and print a team',
    '/library': 'Browse unit and force cards',
    '/forge': 'Create custom units',
  };
  const tiles = NAV_ITEMS.filter((i) => i.path in PURPOSE);
</script>

<div class="home">
  <header class="intro">
    <h1 class="title">Operations center</h1>
    <p class="lede">Your table-side companion for BLKOUT: teams, games and campaigns, all offline.</p>
  </header>

  <ul class="tiles" role="list">
    {#each tiles as t (t.path)}
      <li>
        <a class="tile" href={href(t.path)}>
          <span class="glyph"><Icon name={t.icon} size={26} /></span>
          <span class="t-name">{t.label}</span>
          <span class="t-desc">{PURPOSE[t.path]}</span>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);
  }
  .title {
    font-size: var(--fs-3xl);
    letter-spacing: -0.02em;
  }
  .lede {
    margin-top: var(--sp-2);
    color: var(--c-text-muted);
    font-size: var(--fs-lg);
  }
  .tiles {
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  }
  .tile {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: var(--sp-3);
    align-items: center;
    min-height: 5rem;
    padding: var(--sp-4);
    background: var(--c-surface-1);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-border-strong);
    border-radius: var(--r-xs);
    color: var(--c-text);
    text-decoration: none;
  }
  .tile:hover {
    background: var(--c-surface-2);
    border-left-color: var(--c-accent);
  }
  .tile:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .glyph {
    grid-row: span 2;
    color: var(--c-accent);
  }
  .t-name {
    font-weight: var(--fw-bold);
    font-size: var(--fs-lg);
  }
  .t-desc {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
