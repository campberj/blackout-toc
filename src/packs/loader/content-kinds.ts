import type { ContentKind } from '../schema';
import { CONTENT_KEYS } from '../schema';

export { CONTENT_KEYS } from '../schema';

export const KINDS = Object.keys(CONTENT_KEYS) as ContentKind[];

export interface ContentItem {
  readonly id: string;
}

export const packOf = (id: string): string => id.slice(0, id.indexOf(':'));
export const localOf = (id: string): string => id.slice(id.indexOf(':') + 1);
