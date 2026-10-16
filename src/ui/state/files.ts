import { downloadJson, readJsonFile } from '../../adapters/file/browser';

// Single UI seam to the browser file adapter (features never import adapters directly).

export { readJsonFile };

/** Download an already-serialized JSON string (service exports return text). */
export function saveJsonText(name: string, json: string): void {
  downloadJson(name, JSON.parse(json) as unknown);
}

/** Filesystem-safe base name from a display name. */
export function fileStem(name: string, fallback = 'export'): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || fallback
  );
}
