import { z } from 'zod';
import { Id, Name, RosterModeKey, TextBlock } from '$lib/packs/schema';

// Team list (DESIGN §4 Roster, F1). Persisted app record, not pack content.

export const RosterGroup = z.strictObject({
  /** Optional while drafting; `forceCardsPerGroup` decides whether it is required. */
  forceCardId: Id.optional(),
  unitIds: z.array(Id).max(16).default([]),
});

export const Roster = z.strictObject({
  id: z.string().min(1).max(64),
  name: Name,
  rulesetId: Id,
  mode: RosterModeKey,
  groups: z.array(RosterGroup).max(8).default([]),
  /** Roster-level handler; counts toward group 0's handlers. */
  handlerId: Id.optional(),
  /** Roster-level duster; counts toward group 0 (and its units when the mode says it replaces one). */
  dusterId: Id.optional(),
  notes: TextBlock.default(''),
});

export type RosterGroup = z.infer<typeof RosterGroup>;
export type Roster = z.infer<typeof Roster>;
export type RosterInput = z.input<typeof Roster>;
