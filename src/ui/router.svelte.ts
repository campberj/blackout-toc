// Hash router: works under any base path (GitHub Pages) with no server fallback.

export const ROUTES = [
  '/',
  '/library',
  '/roster',
  '/forge',
  '/dashboard',
  '/campaign',
  '/settings',
  '/dev/gallery',
] as const;

export type RoutePath = (typeof ROUTES)[number];

const NOT_FOUND = '/' satisfies RoutePath;

function isRoute(p: string): p is RoutePath {
  return (ROUTES as readonly string[]).includes(p);
}

/** Normalise "#/roster/" or "#roster?x" to a known path; unknown → home. */
export function parseHash(hash: string): RoutePath {
  let p = hash.replace(/^#/, '').split('?')[0] ?? '';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (p === '/dev/gallery' && !import.meta.env.DEV) return NOT_FOUND;
  return isRoute(p) ? p : NOT_FOUND;
}

/** Query params from "#/campaign?save=abc" (feature-specific ids live here, not in the path). */
export function parseQuery(hash: string): Record<string, string> {
  const q = hash.split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of q.split('&')) {
    if (!pair) continue;
    const [k = '', v = ''] = pair.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

export function href(path: RoutePath, query?: Record<string, string>): string {
  const entries = Object.entries(query ?? {});
  const q = entries.length ? `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : '';
  return `#${path}${q}`;
}

class Router {
  // Read synchronously so the first render is already the right page (no flash, no focus jump).
  path = $state<RoutePath>(parseHash(location.hash));
  query = $state<Record<string, string>>(parseQuery(location.hash));

  start(): () => void {
    const sync = () => {
      this.path = parseHash(location.hash);
      this.query = parseQuery(location.hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }

  go(path: RoutePath, query?: Record<string, string>): void {
    location.hash = href(path, query).slice(1);
  }
}

export const router = new Router();
