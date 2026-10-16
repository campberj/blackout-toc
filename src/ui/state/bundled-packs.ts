import type { BundledPackSource } from '../../app';

// First-party packs shipped in /packs (lazy chunks: only fetched at startup, not in the entry bundle).
const modules = import.meta.glob<unknown>('../../../packs/*.json', { import: 'default' });

export const bundledPacks: BundledPackSource = {
  load: () =>
    Promise.all(
      Object.keys(modules)
        .sort()
        .map((k) => modules[k]!()),
    ),
};
