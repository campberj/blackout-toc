// Test-only helpers for app services. Invented content only.
import demo from '$lib/packs/schema/__fixtures__/demo-pack.json';
import other from '$lib/packs/loader/__fixtures__/other-demo-pack.json';
import expansion from '$lib/packs/loader/__fixtures__/expansion-pack.json';
import { ALL_COLLECTIONS, type Storage } from '$lib/ports';
import { createDriverStorage, toStoreSpecs } from '$lib/adapters/core';
import { createMemoryDriver } from '$lib/adapters/memory';
import { fixedClock } from '$lib/adapters/system';
import type { BundledPackSource } from '../ports';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = Record<string, any>;

export const clock = () => fixedClock('2026-10-16T12:00:00.000Z', 1000);

export const memStorage = (): Storage => createDriverStorage(createMemoryDriver(toStoreSpecs(ALL_COLLECTIONS)), ALL_COLLECTIONS, clock());

export const fx = () => ({
  demo: structuredClone(demo) as Json,
  other: structuredClone(other) as Json,
  expansion: structuredClone(expansion) as Json,
});

export const bundle = (...raws: unknown[]): BundledPackSource => ({ load: async () => raws });

export const ids = (prefix = 'id') => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};

/** Invented rules pack with a `supplemental-2026`-suffixed ruleset (default-ruleset resolution). */
export const rulesPack = (): Json => ({
  format: 'blkout-pack',
  formatVersion: 1,
  id: 'house-rules',
  version: '1.0.0',
  title: 'House rules (invented)',
  author: 'TOC test suite',
  content: {
    rulesets: [
      { id: 'classic', name: 'Classic', startingCp: 2, roundLimit: 6, dusterRules: 'core', coverModel: 'binary' },
      {
        id: 'supplemental-2026',
        name: 'Invented 2026',
        startingCp: 3,
        roundLimit: 5,
        dusterRules: 'core',
        coverModel: 'binary',
        unitLimits: [{ key: 'skill', field: 'skill', min: 4, max: 8, message: 'Skill must be 4–8' }],
      },
    ],
  },
});

/** Valid custom-unit draft referencing demo content. */
export const draft = (over: Json = {}): any => ({
  name: 'Night Wardens',
  faction: 'demo:glasswing',
  type: 'infantry',
  skill: 6,
  move: 6,
  armor: { dice: 1, target: 6 },
  grunts: 2,
  combatLoads: 1,
  weapons: [{ key: 'lamp', name: 'Lamp Gun', maxRange: 12, damage: 1, keywords: [{ key: 'demo:ricochet', x: 1 }] }],
  ...over,
});
