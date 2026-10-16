import {
  CampaignFaction,
  Condition,
  CustomMissionTemplate,
  Effect,
  FactionTable,
  type Pack,
  PackContent,
  RemoveReason,
  Target,
  TargetFilter,
  TriggerEvent,
  TriggerFilter,
} from '../schema';
import { loadError, type LoadError } from './errors';
import { visitAll, type VisitNode } from './traverse';

// The one place that knows which features are v2-only. A v1 pack using any of them is rejected
// (schema accepts the v2 superset, so without this a v1 pack could silently depend on v2 behavior).

interface Feature {
  readonly name: string;
  readonly test: (n: VisitNode) => boolean;
}

const op = (n: VisitNode) => (n.value as { op?: string }).op;

export const V2_FEATURES: readonly Feature[] = [
  { name: 'target filter {from, where}', test: (n) => n.schema === TargetFilter },
  { name: "target 'team'", test: (n) => n.schema === Target && n.value === 'team' },
  { name: "condition 'hasTag'", test: (n) => n.schema === Condition && op(n) === 'hasTag' },
  { name: "condition 'teamMissions'", test: (n) => n.schema === Condition && op(n) === 'teamMissions' },
  { name: "condition 'factionIs'", test: (n) => n.schema === Condition && op(n) === 'factionIs' },
  { name: "effect 'forEachTeam'", test: (n) => n.schema === Effect && op(n) === 'forEachTeam' },
  { name: "rollTable 'byFaction'", test: (n) => n.schema === FactionTable },
  { name: "removeOperator reason 'destroyed'", test: (n) => n.schema === RemoveReason && n.value === 'destroyed' },
  { name: "trigger event 'onPromotion'", test: (n) => n.schema === TriggerEvent && n.value === 'onPromotion' },
  { name: "trigger filter 'rank'", test: (n) => n.schema === TriggerFilter && (n.value as { rank?: unknown }).rank !== undefined },
  { name: "campaign 'customMission'", test: (n) => n.schema === CustomMissionTemplate },
  { name: "campaign 'factions'", test: (n) => n.schema === CampaignFaction },
];

/** v2-only features used by a pack (first site of each). Empty for v2 packs. */
export function checkFormatVersion(pack: Pack): LoadError[] {
  if (pack.formatVersion >= 2) return [];
  const found = new Map<string, LoadError>();
  visitAll(
    PackContent,
    pack.content,
    (n) => {
      for (const f of V2_FEATURES) {
        if (!found.has(f.name) && f.test(n)) found.set(f.name, loadError('schema', n.path, `${f.name} is a v2 feature; set formatVersion: 2`, pack.id));
      }
    },
    ['content'],
  );
  return [...found.values()];
}
