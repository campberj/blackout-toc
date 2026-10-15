import { z } from 'zod';
import { Pack } from './pack';

/** JSON Schema (2020-12) for the pack *input* format — consumed by docs, editors, and AI authoring. */
export function packJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(Pack, { io: 'input', target: 'draft-2020-12', unrepresentable: 'throw', cycles: 'ref', reused: 'inline' });
}
