import { SEMVER_RE } from '../schema';

// Minimal npm-compatible range matcher (no deps): exact, =, <, <=, >, >=, ^, ~, x/X/* partials,
// hyphen ranges, space = AND, `||` = OR. Prereleases match only comparators on the same x.y.z (npm rule).

export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly pre: readonly (string | number)[];
}

export const parseVersion = (v: string): SemVer | undefined => {
  if (!SEMVER_RE.test(v)) return undefined;
  const [core = '', ...rest] = v.split('+')[0]!.split('-');
  const [major, minor, patch] = core.split('.').map(Number) as [number, number, number];
  const preStr = rest.join('-');
  const pre = preStr ? preStr.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [];
  return { major, minor, patch, pre };
};

const cmpIdent = (a: string | number, b: string | number): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

export const compare = (a: SemVer, b: SemVer): number => {
  const d = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (d) return d;
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const c = cmpIdent(a.pre[i]!, b.pre[i]!);
    if (c) return c;
  }
  return 0;
};

type Op = '<' | '<=' | '>' | '>=' | '=';
interface Comparator {
  readonly op: Op;
  readonly v: SemVer;
}
const sv = (major: number, minor = 0, patch = 0, pre: readonly (string | number)[] = []): SemVer => ({ major, minor, patch, pre });

/** Partial version: missing/wildcard parts are undefined. */
interface Partial {
  readonly major?: number;
  readonly minor?: number;
  readonly patch?: number;
  readonly pre: readonly (string | number)[];
}
const PARTIAL_RE = /^v?(\d+|[xX*])?(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const num = (s: string | undefined) => (s === undefined || /^[xX*]$/.test(s) ? undefined : Number(s));

const parsePartial = (s: string): Partial | undefined => {
  const m = PARTIAL_RE.exec(s);
  if (!m || s === '') return undefined;
  const major = num(m[1]);
  const minor = major === undefined ? undefined : num(m[2]);
  const patch = minor === undefined ? undefined : num(m[3]);
  const pre = m[4] && patch !== undefined ? (parseVersion(`0.0.0-${m[4]}`)?.pre ?? []) : [];
  return { ...(major !== undefined && { major }), ...(minor !== undefined && { minor }), ...(patch !== undefined && { patch }), pre };
};

const floor = (p: Partial) => sv(p.major ?? 0, p.minor ?? 0, p.patch ?? 0, p.pre);
/** Exclusive upper bound for a partial (`1` → 2.0.0, `1.2` → 1.3.0). */
const ceilX = (p: Partial): SemVer | undefined =>
  p.major === undefined ? undefined : p.minor === undefined ? sv(p.major + 1) : sv(p.major, p.minor + 1);

const xRange = (p: Partial): Comparator[] => {
  if (p.patch !== undefined) return [{ op: '=', v: floor(p) }];
  const hi = ceilX(p);
  return hi ? [{ op: '>=', v: floor(p) }, { op: '<', v: hi }] : [];
};

const caret = (p: Partial): Comparator[] => {
  if (p.major === undefined) return [];
  const lo = floor(p);
  const hi =
    p.major > 0 || p.minor === undefined
      ? sv(p.major + 1)
      : p.minor > 0 || p.patch === undefined
        ? sv(0, p.minor + 1)
        : sv(0, 0, p.patch + 1);
  return [{ op: '>=', v: lo }, { op: '<', v: hi }];
};

const tilde = (p: Partial): Comparator[] => {
  if (p.major === undefined) return [];
  const hi = p.minor === undefined ? sv(p.major + 1) : sv(p.major, p.minor + 1);
  return [{ op: '>=', v: floor(p) }, { op: '<', v: hi }];
};

const primitive = (op: Op, p: Partial): Comparator[] | undefined => {
  if (op === '=') return xRange(p);
  if (p.major === undefined) return op === '<' || op === '>' ? undefined : [];
  if (p.patch !== undefined) return [{ op, v: floor(p) }];
  const hi = ceilX(p)!;
  switch (op) {
    case '>=':
      return [{ op: '>=', v: floor(p) }];
    case '>':
      return [{ op: '>=', v: hi }];
    case '<':
      return [{ op: '<', v: floor(p) }];
    case '<=':
      return [{ op: '<', v: hi }];
  }
};

const TOKEN_RE = /^(<=|>=|<|>|=|\^|~)?(.*)$/;

const parseComparators = (set: string): Comparator[] | undefined => {
  const hy = /^(\S+)\s+-\s+(\S+)$/.exec(set);
  if (hy) {
    const a = parsePartial(hy[1]!);
    const b = parsePartial(hy[2]!);
    if (!a || !b) return undefined;
    const hi = b.patch !== undefined ? [{ op: '<=' as const, v: floor(b) }] : ceilX(b) ? [{ op: '<' as const, v: ceilX(b)! }] : [];
    return [{ op: '>=', v: floor(a) }, ...hi];
  }
  const out: Comparator[] = [];
  for (const tok of set.replace(/(<=|>=|<|>|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean)) {
    const [, op, rest = ''] = TOKEN_RE.exec(tok)!;
    const p = parsePartial(rest);
    if (!p) return undefined;
    const cs = op === '^' ? caret(p) : op === '~' ? tilde(p) : primitive((op ?? '=') as Op, p);
    if (!cs) return undefined;
    out.push(...cs);
  }
  return out;
};

export interface SemverRange {
  test(version: string | SemVer): boolean;
}

/** Parse an npm-style range; undefined when malformed. */
export const parseRange = (range: string): SemverRange | undefined => {
  const sets: Comparator[][] = [];
  for (const part of range.trim().split('||')) {
    const cs = parseComparators(part.trim());
    if (!cs) return undefined;
    sets.push(cs);
  }
  return {
    test(version) {
      const v = typeof version === 'string' ? parseVersion(version) : version;
      if (!v) return false;
      return sets.some((cs) => {
        const okAll = cs.every(({ op, v: c }) => {
          const d = compare(v, c);
          return op === '=' ? d === 0 : op === '<' ? d < 0 : op === '<=' ? d <= 0 : op === '>' ? d > 0 : d >= 0;
        });
        if (!okAll || !v.pre.length) return okAll;
        return cs.some(({ v: c }) => c.pre.length > 0 && c.major === v.major && c.minor === v.minor && c.patch === v.patch);
      });
    },
  };
};

export const satisfies = (version: string, range: string): boolean => parseRange(range)?.test(version) ?? false;
