// Public surface of the game session (F3). App code imports from here only.
export { createGameEngine, replayGame, type GameEngine, type GameDispatchResult, type GameRejection, type GameAccepted } from './engine';
export { gameReducer } from './reducer';
export { decideGame, checkCommand, type GameIssue } from './decider';
export { GameCommand, GAME_EVENT_TYPES, GAME_EVENT_PAYLOADS, validateGameEvent, type GameCommandInput, type GameEvent, type GameEventType } from './commands';
export * from './schema';
export * from './state';
export { toAarPrefill, observedStatus } from './aar';
export { describeEvent, gameLog, type LogEntry } from './describe';
export {
  FALLBACK_PROFILE,
  limitedRules,
  modelsForCard,
  scenarioParts,
  setupFromLaunch,
  setupFromRoster,
  templateFromCard,
  templateFromContact,
  type BuiltSetup,
  type ScenarioParts,
} from './setup';
