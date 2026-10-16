import { describe, expect, it } from 'vitest';
import { checkFieldRecord, checkFieldValue } from './fields';

describe('field validation', () => {
  it('checks each kind', () => {
    expect(checkFieldValue({ key: 'b', kind: 'boolean' }, 1)).toMatch(/boolean/);
    expect(checkFieldValue({ key: 'n', kind: 'number' }, 'x')).toMatch(/number/);
    expect(checkFieldValue({ key: 'n', kind: 'number', min: 1 }, 0)).toMatch(/minimum/);
    expect(checkFieldValue({ key: 'n', kind: 'number', max: 1 }, 2)).toMatch(/maximum/);
    expect(checkFieldValue({ key: 't', kind: 'text' }, 3)).toMatch(/text/);
    expect(checkFieldValue({ key: 't', kind: 'text' }, 'ok')).toBeUndefined();
    expect(checkFieldRecord([{ key: 'b', kind: 'boolean' }], { z: true }, 'X')).toBe('X: unknown field "z"');
  });
});
