/*
 * Invented demo units for UI review only. Not ESS content: names, factions,
 * stats and rules are original placeholders.
 */
import type { CardViewModel } from '$lib/app/view-models/card-view-model';

export const DEMO_RECON: CardViewModel = {
  id: 'demo:kestrel-cell',
  name: 'Kestrel Recon Cell',
  faction: 'Meridian Free Company',
  type: 'Infantry',
  stats: [
    { label: 'Skill', value: '6+' },
    { label: 'Move', value: '6"' },
  ],
  armor: '1/5',
  grunts: 3,
  specialists: [
    { name: 'Spotter', text: 'Once per round, mark one enemy in sight as tagged.' },
    { name: 'Breacher', text: 'Ignores the first closed door each activation.' },
  ],
  combatLoads: 2,
  rules: [
    { name: 'Quiet feet', text: 'This unit does not trigger alarms while moving at half speed.' },
    { name: 'Relay uplink', text: 'Pass one command point to a friendly unit within 12".', usesMax: 2 },
  ],
  weapons: [
    { name: 'Suppressed carbine', profile: '0–24"  D1  Hushed' },
    { name: 'Frag charge', profile: '3–8"  D2  Spread (1), Single use' },
  ],
  damageTracks: [],
  keywords: ['Recon', 'Light'],
};

export const DEMO_HANDLER: CardViewModel = {
  id: 'demo:warden-osei',
  name: 'Warden Osei',
  faction: 'Meridian Free Company',
  type: 'Handler',
  stats: [
    { label: 'Skill', value: '5+' },
    { label: 'Move', value: '5"' },
  ],
  armor: '2/5',
  grunts: 0,
  specialists: [],
  combatLoads: 1,
  rules: [
    { name: 'Steady voice', text: 'Friendly units within 6" may re-roll one failed rally test.' },
    { name: 'Call the shot', text: 'Spend before a friendly attack: +1 to its first die.', usesMax: 3 },
  ],
  weapons: [{ name: 'Service pistol', profile: '0–12"  D1' }],
  damageTracks: [{ name: 'Wounds', size: 2 }],
  custom: true,
};

export const DEMO_CARDS: readonly CardViewModel[] = [DEMO_RECON, DEMO_HANDLER];
