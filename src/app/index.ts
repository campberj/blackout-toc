// App layer public API: features import from here (or src/ui/state), never from storage/loader/engine.
export { createAppContext, type AppContext, type AppContextOptions } from './context';
export type * from './contracts/game-campaign';
export { createStorage, type AppStorage, type StorageOptions } from './storage';
export * from './ports';
export { createEmitter, type Emitter } from './emitter';
export { formatLoadError, formatLoadErrors, formatIssue, humanPath, type LibraryError, type LibraryErrorCode } from './errors';
export {
  createPackLibrary,
  USER_PACK_ID,
  type PackLibrary,
  type PackInfo,
  type LibrarySnapshot,
  type ImportResult,
} from './pack-library';
export {
  createCampaignService,
  campaignPackVersions,
  packDrift,
  CampaignSave,
  type CampaignService,
  type OpenCampaign,
  type CampaignSaveSummary,
  type CreateCampaignInput,
  type PackDrift,
} from './campaign-service';
export {
  createRosterService,
  Roster,
  type RosterInput,
  type RosterService,
  type SavedRoster,
  type RosterPrintModel,
  type NewRosterInput,
} from './roster-service';
export { createCustomUnitService, slugify, type CustomUnitService, type UnitDraft, type SavedUnit } from './custom-unit-service';
export {
  createSessionService,
  SessionRecord,
  type SessionService,
  type OpenSession,
  type SessionSummary,
  type NewSessionInput,
  type Accepted as SessionAccepted,
} from './session-service';
export {
  MODEL_STATUSES,
  PHASES,
  SIDES,
  dueObjectives,
  findModel,
  findUnit,
  hasDamage,
  isOut,
  score,
  timingText,
  unitsOf,
  type CustomContact,
  type GameCommandInput,
  type GameIssue,
  type GameRejection,
  type GameState,
  type LogEntry,
  type ModelState,
  type ModelStatus,
  type ObjectiveState,
  type Phase,
  type Side,
  type SideState,
  type UnitState,
} from '../domain/game';
export { createSettingsService, DEFAULT_RULESET_SUFFIX, type SettingsService, type AppSettings } from './settings-service';
export {
  toCardViewModel,
  toForceCardViewModel,
  cardKeys,
  keywordGlossary,
  isCustom,
  type CardContext,
  type CardKeys,
  type KeywordGlossaryEntry,
} from './card-mapper';
export { hasErrors, type ValidationIssue, type IssueSeverity } from '../domain/rules';
