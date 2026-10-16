/*
 * Presentation model for ForceCardView: display-ready strings, built by
 * src/app/card-mapper.ts. Arrays keep pack order (dashboard index alignment).
 */

export interface ForceAbilityVM {
  name: string;
  text: string;
  /** e.g. "1 CP". */
  cost?: string;
  usesMax?: number;
}

export interface ForceArmoryVM {
  kind: 'weapon' | 'ability';
  name: string;
  /** Weapon profile + keywords; '' for abilities. */
  profile: string;
  text?: string;
  cost?: string;
  usesMax?: number;
}

export interface ForceCardViewModel {
  id: string;
  name: string;
  faction: string;
  forceRule: string;
  battleDrills: ForceAbilityVM[];
  armory: ForceArmoryVM[];
  dusterArmory: ForceArmoryVM[];
}
