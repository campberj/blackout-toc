<script lang="ts">
  import type { Component } from 'svelte';
  import ClassificationBanner from './shell/ClassificationBanner.svelte';
  import AppHeader from './shell/AppHeader.svelte';
  import AppNav from './shell/AppNav.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import HomePage from './features/home/HomePage.svelte';
  import LibraryPage from './features/library/LibraryPage.svelte';
  import RosterPage from './features/roster/RosterPage.svelte';
  import ForgePage from './features/forge/ForgePage.svelte';
  import DashboardPage from './features/dashboard/DashboardPage.svelte';
  import CampaignPage from './features/campaign/CampaignPage.svelte';
  import SettingsPage from './features/settings/SettingsPage.svelte';
  import { router, type RoutePath } from './router.svelte';
  import { NAV_ITEMS } from './nav';

  const PAGES: Record<Exclude<RoutePath, '/dev/gallery'>, Component> = {
    '/': HomePage,
    '/library': LibraryPage,
    '/roster': RosterPage,
    '/forge': ForgePage,
    '/dashboard': DashboardPage,
    '/campaign': CampaignPage,
    '/settings': SettingsPage,
  };

  // Gallery is code-split and only reachable in dev (router also blocks it in prod).
  let Gallery = $state<Component | null>(null);
  $effect(() => {
    if (import.meta.env.DEV && router.path === '/dev/gallery' && !Gallery) {
      void import('./dev/Gallery.svelte').then((m) => (Gallery = m.default));
    }
  });

  $effect(() => router.start());

  const section = $derived(
    router.path === '/dev/gallery' ? 'Gallery' : (NAV_ITEMS.find((i) => i.path === router.path)?.label ?? ''),
  );

  // Move focus to main on navigation so screen-reader/keyboard users land on the new page.
  let main: HTMLElement | undefined = $state();
  let first = true;
  $effect(() => {
    void router.path;
    if (first) {
      first = false;
      return;
    }
    main?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });

  const Current = $derived(router.path === '/dev/gallery' ? Gallery : PAGES[router.path]);
</script>

<svelte:head>
  <title>{section && section !== 'Home' ? `${section} · BLKOUT: TOC` : 'BLKOUT: TOC'}</title>
</svelte:head>

<a class="skip no-print" href="#main" onclick={(e) => { e.preventDefault(); main?.focus(); }}>Skip to content</a>

<div class="shell">
  <div class="top">
    <ClassificationBanner />
    <AppHeader {section} />
  </div>
  <div class="nav-slot no-print">
    <AppNav items={NAV_ITEMS} current={router.path} />
  </div>
  <main id="main" class="main" tabindex="-1" bind:this={main}>
    <div class="content">
      {#if Current}
        <Current />
      {/if}
    </div>
    <footer class="foot">
      <p>Unofficial fan tool, not affiliated with Enemy Spotted Studios.</p>
    </footer>
  </main>
</div>

<ToastHost />

<style>
  /*
   * Portrait / phone: banner+header on top, content, fixed bottom tab bar.
   * Landscape tablet / desktop: side rail on the left, content to the right.
   */
  .shell {
    display: grid;
    grid-template-areas: 'top' 'main';
    grid-template-rows: auto 1fr;
    min-height: 100dvh;
  }
  .top {
    grid-area: top;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .nav-slot {
    position: fixed;
    z-index: 30;
    inset: auto 0 0;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--c-surface-1);
    border-top: 1px solid var(--c-border);
  }
  .main {
    grid-area: main;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
  }
  .main:focus {
    outline: none;
  }
  .content {
    flex: 1;
    width: 100%;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--sp-5) var(--gutter) var(--sp-6);
  }
  .foot {
    padding: var(--sp-4) var(--gutter);
    border-top: 1px solid var(--c-border);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    text-align: center;
  }
  .foot p {
    max-width: none;
  }

  @media (orientation: landscape) and (min-width: 768px), (min-width: 1024px) {
    .shell {
      grid-template-areas: 'top top' 'nav main';
      grid-template-columns: var(--rail-w) 1fr;
    }
    /* Slot stretches full height (rail background); the nav inside sticks. */
    .nav-slot {
      grid-area: nav;
      position: static;
      z-index: 10; /* grid items honor z-index: keep the rail under the sticky header */
      height: auto;
      padding-bottom: 0;
      border-top: 0;
      border-right: 1px solid var(--c-border);
    }
    .nav-slot > :global(nav) {
      position: sticky;
      top: calc(var(--banner-h) + var(--header-h));
      height: calc(100dvh - var(--banner-h) - var(--header-h));
    }
    .main {
      padding-bottom: 0;
    }
  }

  .skip {
    position: absolute;
    z-index: 100;
    left: var(--sp-2);
    top: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    background: var(--c-accent);
    color: var(--c-on-accent);
    font-weight: var(--fw-bold);
    transform: translateY(-200%);
  }
  .skip:focus {
    transform: none;
  }

  @media print {
    .shell {
      display: block;
    }
    .top,
    .foot {
      display: none;
    }
    .main {
      padding: 0;
    }
    .content {
      padding: 0;
      max-width: none;
    }
  }
</style>
