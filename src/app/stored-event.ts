import { z } from 'zod';

/** Persisted event-log entry shared by campaign saves and game sessions. `cmd` (undo unit) is absent in pre-v2 records; load fills it in. */
export const StoredEvent = z.object({
  seq: z.number().int().min(1),
  cmd: z.number().int().min(1).optional(),
  type: z.string().min(1),
  at: z.string().optional(),
  payload: z.unknown(),
});
export type StoredEvent = z.infer<typeof StoredEvent>;
