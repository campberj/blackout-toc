// The only DOM-touching persistence code. Keep it thin; logic belongs in backup.ts.

/** Trigger a browser download of `data` as pretty-printed JSON. */
export function downloadJson(name: string, data: unknown): void {
  const filename = name.endsWith('.json') ? name : `${name}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  try {
    a.click();
  } finally {
    a.remove();
    // Defer revoke: some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export class JsonFileError extends Error {
  override readonly name = 'JsonFileError';
}

/** Read a user-picked file as JSON. Result is `unknown`: callers must validate (e.g. Zod). */
export async function readJsonFile(file: Blob, maxBytes = 50 * 1024 * 1024): Promise<unknown> {
  if (file.size > maxBytes) throw new JsonFileError(`File too large (${file.size} bytes, max ${maxBytes})`);
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new JsonFileError('File is not valid JSON', { cause });
  }
}
