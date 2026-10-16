import type { Campaign, NarrativeRef } from '$lib/packs/schema';

// Read authored narrative outside the engine (previews only; the engine renders the real text into the feed).

export interface NarrativeText {
  title: string | null;
  text: string;
  speaker: string | null;
}

export function resolveNarrative(campaign: Campaign, ref: NarrativeRef | undefined): NarrativeText | null {
  if (ref === undefined) return null;
  const body = typeof ref === 'string' ? campaign.narratives.find((n) => n.key === ref) : ref;
  if (!body) return null;
  return { title: body.title ?? null, text: body.text, speaker: body.speaker ?? null };
}

const HEADER = /^\s*\/\/\/.*\/\/\/\s*$/;

/**
 * Short plain preview: drops `/// header ///` and classification lines, keeps the first
 * paragraph, blanks `{{vars}}` (unrendered here), and truncates on a word boundary.
 */
export function previewText(text: string, max = 180): string {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').filter((l) => !HEADER.test(l) && !/^CLASSIFICATION:/i.test(l.trim())).join(' ').trim())
    .filter(Boolean);
  const first = (paras[0] ?? '').replace(/\{\{[^}]*\}\}/g, '…').replace(/\s+/g, ' ');
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}
