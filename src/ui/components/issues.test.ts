import { describe, expect, it } from 'vitest';
import type { ValidationIssue } from '../../app';
import { fieldMessage, issuesAt, splitBySeverity, unclaimed } from './issues';

const i = (severity: 'error' | 'warning', path: string, message = path): ValidationIssue => ({ severity, path, code: 'x', message });
const all = [i('warning', 'skill', 'warn'), i('error', 'skill', 'err'), i('error', 'weapons.0.maxRange'), i('error', '')];

describe('issue helpers', () => {
  it('matches exact paths', () => {
    expect(issuesAt(all, 'skill')).toHaveLength(2);
    expect(issuesAt(all, 'weapons.0')).toEqual([]);
  });
  it('prefers errors for the field message', () => {
    expect(fieldMessage(all, 'skill')).toBe('err');
    expect(fieldMessage(all, 'move')).toBeUndefined();
  });
  it('splits and filters unclaimed', () => {
    expect(splitBySeverity(all).warnings).toHaveLength(1);
    expect(unclaimed(all, (p) => p === 'skill').map((x) => x.path)).toEqual(['weapons.0.maxRange', '']);
  });
});
