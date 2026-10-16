import type { Id } from '../packs/schema';
import type { BackupService, Clock, Storage } from '../ports';
import { systemClock } from '../adapters/system';
import { createCampaignService, type CampaignService } from './campaign-service';
import type { CardContext } from './card-mapper';
import { createCustomUnitService, type CustomUnitService } from './custom-unit-service';
import { createPackLibrary, type LibrarySnapshot, type PackLibrary } from './pack-library';
import { randomId, randomSeed, type BundledPackSource, type IdSource, type SeedSource, type ThemePort } from './ports';
import { createRosterService, type RosterService } from './roster-service';
import { createSettingsService, type SettingsService } from './settings-service';
import type { GameCampaignBridge } from './contracts/game-campaign';
import { createSessionService, type SessionService } from './session-service';

// Composition root (DIP): features receive this context and never touch storage, loader or engine.

export interface AppContextOptions {
  readonly clock?: Clock;
  readonly newId?: IdSource;
  readonly newSeed?: SeedSource;
  readonly theme?: ThemePort;
  /** Full-data backup (from createStorage); absent in tests/embeds. */
  readonly backup?: BackupService;
}

export interface AppContext {
  /** False on the in-memory fallback: warn that data is lost on reload. */
  readonly isPersistent: boolean;
  /** Full export/import of all collections; undefined when not wired. */
  readonly backup: BackupService | undefined;
  readonly library: PackLibrary;
  readonly settings: SettingsService;
  readonly campaigns: CampaignService;
  readonly rosters: RosterService;
  readonly customUnits: CustomUnitService;
  /** Game dashboard sessions (F3). */
  readonly sessions: SessionService;
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
  const clock = opts.clock ?? systemClock;
  const sessions = createSessionService({ storage, content: snapshot, activeRulesetId, clock, newId });

  return {
    isPersistent: storage.isPersistent,
    backup: opts.backup,
    library,
    settings,
    campaigns: createCampaignService({
      storage,
      content: snapshot,
      clock,
      newId,
      newSeed: opts.newSeed ?? randomSeed,
      excludedTags: () => settings.current.excludedTags,
    }),
    rosters: createRosterService({ storage, content: snapshot, activeRulesetId, newId }),
    customUnits: createCustomUnitService({ library, activeRulesetId }),
    sessions,
    gameBridge: sessions,
    snapshot,
    activeRulesetId,
    cardContext: () => ({ lookup: library.snapshot.registry, rulesetId: activeRulesetId() }),
  };
}
