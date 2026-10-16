import type { LoadError, LoadErrorCode } from '../packs/loader';
import type { ValidationIssue } from '../domain/rules';

// One formatter for loader/library errors and validation issues (DRY; UI shows these verbatim).

export type LibraryErrorCode = LoadErrorCode | 'not_found' | 'read_only' | 'required_by';
/** Loader errors plus library-level refusals; every LoadError is a LibraryError. */
export interface LibraryError extends Omit<LoadError, 'code'> {
  readonly code: LibraryErrorCode;
}

const unesc = (s: string) => s.replace(/~1/g, '/').replace(/~0/g, '~');

/** RFC 6901 pointer → `content.units[2].skill`. */
export function humanPath(pointer: string): string {
  if (!pointer) return '';
  return pointer
    .split('/')
    .slice(1)
    .map(unesc)
    .reduce((acc, seg) => (/^\d+$/.test(seg) ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg), '');
}

/** `Pack "demo" › content.units[2].skill: Too big`. */
export function formatLoadError(e: LibraryError): string {
  const where = [e.packId === undefined ? '' : `Pack "${e.packId}"`, humanPath(e.path)].filter(Boolean).join(' › ');
  return where ? `${where}: ${e.message}` : e.message;
}

export const formatLoadErrors = (errors: readonly LibraryError[]): string[] => errors.map(formatLoadError);

export function formatIssue(i: ValidationIssue): string {
  return i.path ? `${i.path}: ${i.message}` : i.message;
}

export const libraryError = (code: LibraryErrorCode, message: string, packId?: string, path = ''): LibraryError =>
  packId === undefined ? { code, path, message } : { packId, code, path, message };
