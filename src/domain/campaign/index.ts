// Public surface of the campaign engine. Features import from here only.
export { createCampaignEngine, replayCampaign, campaignReducer, type CampaignEngine, type CampaignDispatchResult } from './engine';
export {
  CampaignCommand,
  CAMPAIGN_EVENT_TYPES,
  EVENT_PAYLOADS,
  validateEvent,
  type Aar,
  type AarInput,
  type CampaignCommandInput,
  type CampaignEvent,
  type CampaignEventType,
  type StartCampaignInput,
} from './commands';
export * from './state';
export { TEMPLATE_ROOTS, renderTemplate } from './narrative';
export { MAX_DEPTH, MAX_STEPS } from './context';
export type { MissionView } from './timeline';
