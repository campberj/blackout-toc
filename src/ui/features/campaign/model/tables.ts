import type { Campaign, Table } from '$lib/packs/schema';
import type { ContentLookup } from '$lib/domain/content';
import { qualify } from '$lib/domain/campaign';

// Random tables a campaign exposes: tables shipped in the campaign's own pack, minus the name table.

export interface TableOption {
  id: string;
  name: string;
  text: string | null;
  entries: number;
}

export function campaignTables(campaign: Campaign, lookup: ContentLookup): TableOption[] {
  const pack = `${campaign.id.slice(0, campaign.id.indexOf(':'))}:`;
  const nameTable = campaign.roster.nameTable ? qualify(campaign.id, campaign.roster.nameTable) : null;
  return lookup
    .list('table')
    .filter((t: Table) => t.id.startsWith(pack) && t.id !== nameTable)
    .map((t) => ({ id: t.id, name: t.name, text: t.text ?? null, entries: t.entries.length }));
}
