import { describe, expect, it } from 'vitest';
import { packJsonSchema } from './index';

describe('packJsonSchema', () => {
  const schema = packJsonSchema() as { $defs: Record<string, unknown>; properties: Record<string, unknown> };
  it('emits named defs for the DSLs and recursive Condition via $ref', () => {
    for (const d of ['Condition', 'Effect', 'Target', 'Campaign', 'UnitCard', 'Errata']) expect(schema.$defs[d], d).toBeDefined();
    expect(JSON.stringify(schema.$defs.Condition)).toContain('"$ref":"#/$defs/Condition"');
  });
  it('is deterministic', () => {
    expect(JSON.stringify(packJsonSchema())).toBe(JSON.stringify(schema));
  });
  it('describes the input format (defaulted fields optional)', () => {
    const required = (schema.$defs.Pack as { required: string[] }).required;
    expect(required).toContain('format');
    expect(required).not.toContain('content');
  });
});
