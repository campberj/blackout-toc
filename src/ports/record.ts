import { z } from 'zod';

/** Envelope fields stamped by the storage adapter — domain code never sets these. */
export const RecordMetaSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type RecordMeta = z.infer<typeof RecordMetaSchema>;

/** On-disk shape: adapter meta + the domain value untouched. */
export const StoredRecordSchema = z.object({ meta: RecordMetaSchema, data: z.unknown() });
export type StoredRecord = z.infer<typeof StoredRecordSchema>;
