import type { Id } from '../packs/schema';
import type { Clock, Storage } from '../ports';
import { systemClock } from '../adapters/system';
import { createCampaignService, type CampaignService } from './campaign-service';
import type { CardContext } from './card-mapper';
import { createCustomUnitService, type CustomUnitService } from './custom-unit-service';
import { createPackLibrary, type LibrarySnapshot, type PackLibrary } from './pack-library';
import { randomId, randomSeed, type BundledPackSource, type IdSource, type SeedSource, type ThemePort } from './ports';
import { createRosterService, type RosterService } from './roster-service';
import { createSettingsService, type SettingsService } from './settings-service';
import type { GameCampaignBridge } from './contracts/game-campaign';

/** Placeholder until the session service (WP7) lands; WP7 replaces this wiring. */
const unavailableBridge: GameCampaignBridge = {
  launch: () => Promise.reject(new Error('Game dashboard not available yet')),
  prefillFor: () => Promise.resolve(undefined),
  consume: () => Promise.resolve(),
};

// Composition root (DIP): features receive this context and never touch storage, loader or engine.

export interface AppContextOptions {
  readonly clock?: Clock;
  readonly newId?: IdSource;
  readonly newSeed?: SeedSource;
  readonly theme?: ThemePort;
}

export interface AppContext {
  /** False on the in-memory fallback: warn that data is lost on reload. */
  readonly isPersistent: boolean;
  readonly library: PackLibrary;
  readonly settings: SettingsService;
  readonly campaigns: CampaignService;
  readonly rosters: RosterService;
  readonly customUnits: CustomUnitService;
  /** Campaign ↔ dashboard handoff (ISP: the campaign UI sees only this). */
  readonly gameBridge: GameCampaignBridge;
  /** Current loaded content (changes on pack import/enable/disable/remove). */
  snapshot(): LibrarySnapshot;
  activeRulesetId(): Id | undefined;
  /** Mapper context bound to the current registry + active ruleset. */
  cardContext(): CardContext;
}

export async function createAppContext(storage: Storage, bundled: BundledPackSource, opts: AppContextOptions = {}): Promise<AppContext> {
  const newId = opts.newId ?? randomId;
  const library = createPackLibrary(storage, bundled);
  const settings = createSettingsService(storage, opts.theme);
  await settings.load();
  await library.init();

  const snapshot = () => library.snapshot;
  const activeRulesetId = () => settings.resolveRuleset(library.snapshot.registry);

  return {
    isPersistent: storage.isPersistent,
    library,
    settings,
    campaigns: createCampaignService({
      storage,
      content: snapshot,
      clock: opts.clock ?? systemClock,
      newId,
      newSeed: opts.newSeed ?? randomSeed,
      excludedTags: () => settings.current.excludedTags,
    }),
    rosters: createRosterService({ storage, content: snapshot, activeRulesetId, newId }),
    customUnits: createCustomUnitService({ library, activeRulesetId }),
    gameBridge: unavailableBridge,
    snapshot,
    activeRulesetId,
    cardContext: () => ({ lookup: library.snapshot.registry, rulesetId: activeRulesetId() }),
  };
}
