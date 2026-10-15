import type { RoutePath } from './router.svelte';
import type { IconName } from './components/icons';

export interface NavItem {
  path: RoutePath;
  label: string;
  icon: IconName;
}

// Order = table-use priority (DESIGN §1): play, campaign, team, cards.
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/dashboard', label: 'Game', icon: 'dashboard' },
  { path: '/campaign', label: 'Campaign', icon: 'campaign' },
  { path: '/roster', label: 'Roster', icon: 'roster' },
  { path: '/library', label: 'Library', icon: 'library' },
  { path: '/forge', label: 'Forge', icon: 'forge' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];
