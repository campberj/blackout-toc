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

export function href(path: RoutePath): string {
  return `#${path}`;
}

class Router {
  // Read synchronously so the first render is already the right page (no flash, no focus jump).
  path = $state<RoutePath>(parseHash(location.hash));

  start(): () => void {
    const sync = () => {
      this.path = parseHash(location.hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }

  go(path: RoutePath): void {
    location.hash = path;
  }
}

export const router = new Router();
