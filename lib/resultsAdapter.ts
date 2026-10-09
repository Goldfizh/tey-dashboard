// Zet de platte CampaignRow[] (Google Sheets-export, per campagne per dag) om naar
// het generieke resultaten-datamodel uit types/results.ts (ChannelResultRow/DailyEntity/
// GroupedEntity), zodat Totaaloverzicht/Kanalen/Analyse er zonder kennis van de brondata
// mee kunnen werken. `kpi` (targets) en `comments` horen hier niet bij — die vult de
// gebruiker zelf in via de UI en blijven in localStorage bewaard (zie app/page.tsx).

import type { CampaignRow, Platform } from '@/types/campaign';
import { classifyObjective } from '@/types/objective';
import { emptyKpi, sumSpendVolumes, type ChannelResultRow, type SpendVolumes } from '@/types/results';
import type { DailyEntity, GroupedEntity } from '@/lib/channelDrilldown';

export const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  meta: 'Meta',
  youtube: 'YouTube',
  google: 'Google Ads',
};

// De kanalen die nu actief in de UI staan (Totaaloverzicht/Kanalen-dropdown). Google Ads/SEA
// bestaat wel als Platform-waarde (voor Sollicitaties' kosten-per-sollicitatie-attributie) maar
// komt hier nog niet in — dat volgt zodra het SEA-blad wordt gebouwd.
export const ACTIVE_CHANNELS: Platform[] = ['meta', 'linkedin', 'youtube'];

export function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'row';
}

export function rowToSpendVolumes(row: CampaignRow): SpendVolumes {
  return {
    spend: row.spend,
    volumes: {
      impressions: row.impressions,
      reach: row.reach,
      clicks: row.clicks,
      completedViews: row.thruplays,
      conversions: row.conversions,
    },
  };
}

function activePairKeysFor(campaignName: string): string[] {
  switch (classifyObjective(campaignName)) {
    case 'verkeer': return ['clicks'];
    case 'video': return ['completedViews'];
    case 'leads':
    case 'conversies': return ['conversions'];
    case 'impressies':
    default: return [];
  }
}

// Groepeert ruwe rijen op (platform, campagnenaam) met hetzelfde id-schema als
// buildResultRows — zodat de UI, bij een geselecteerde rij, de bijbehorende ruwe
// (dag-niveau) rijen kan terugvinden voor bv. een dag-grafiek van die ene campagne.
export function buildRawGroups(rows: CampaignRow[], channels: Platform[] = ACTIVE_CHANNELS): Map<string, { platform: Platform; campaign_name: string; rows: CampaignRow[] }> {
  const byKey = new Map<string, { platform: Platform; campaign_name: string; rows: CampaignRow[] }>();
  for (const r of rows) {
    if (!channels.includes(r.platform)) continue;
    const id = `${r.platform}__${slugify(r.campaign_name)}`;
    const entry = byKey.get(id);
    if (entry) entry.rows.push(r);
    else byKey.set(id, { platform: r.platform, campaign_name: r.campaign_name, rows: [r] });
  }
  return byKey;
}

// Eén ChannelResultRow per (platform, campagnenaam) — dient zowel als bewerkbare rij in
// Totaaloverzicht als keuze-chip binnen het gekozen kanaal in Kanalen. `kpi` is altijd leeg;
// bestaande targets worden er in app/page.tsx overheen gemerged (localStorage), nooit hier.
export function buildResultRows(rows: CampaignRow[], channels: Platform[] = ACTIVE_CHANNELS): ChannelResultRow[] {
  const groups = buildRawGroups(rows, channels);
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.campaign_name.localeCompare(b.campaign_name))
    .map(([id, { platform, campaign_name, rows: groupRows }]) => ({
      id,
      kanaal: PLATFORM_LABEL[platform],
      campagne: campaign_name,
      achieved: sumSpendVolumes(groupRows.map(rowToSpendVolumes)),
      kpi: emptyKpi(),
      activePairKeys: activePairKeysFor(campaign_name),
      comments: [],
    }));
}

// Per-dag optelling — voedt PacingChart/GoalDailyChart/ComparisonTool/de "dag"-groepering in
// Analyse. `rows` moet vooraf al gefilterd zijn op kanaal/campagne-selectie.
export function buildDailyEntities(rows: CampaignRow[]): DailyEntity[] {
  const byDate = new Map<string, CampaignRow[]>();
  for (const r of rows) {
    const list = byDate.get(r.date);
    if (list) list.push(r); else byDate.set(r.date, [r]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => ({ date, metrics: sumSpendVolumes(dayRows.map(rowToSpendVolumes)) }));
}

export function groupByCampagne(rows: CampaignRow[]): GroupedEntity[] {
  const byKey = new Map<string, { label: string; rows: CampaignRow[] }>();
  for (const r of rows) {
    const key = `${r.platform}__${r.campaign_name}`;
    const entry = byKey.get(key);
    if (entry) entry.rows.push(r);
    else byKey.set(key, { label: `${PLATFORM_LABEL[r.platform]} — ${r.campaign_name}`, rows: [r] });
  }
  return [...byKey.values()].map(({ label, rows: groupRows }) => ({
    label,
    metrics: sumSpendVolumes(groupRows.map(rowToSpendVolumes)),
  }));
}

// Ververst alleen `achieved` van bestaande rijen (gematcht op id) met verse cijfers; kpi/
// comments/activePairKeys/kanaal/campagne — alles wat de gebruiker zelf heeft ingevuld of
// aangepast via ResultsPerChannelTable/MetricPairManager — blijft ongemoeid. Nieuwe campagnes
// (nieuw id) worden toegevoegd; rijen die de gebruiker zelf handmatig heeft toegevoegd
// (geen match in `fresh`) blijven gewoon bestaan.
export function mergeAchieved(prev: ChannelResultRow[], fresh: ChannelResultRow[]): ChannelResultRow[] {
  const freshById = new Map(fresh.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const merged = prev.map((r) => {
    const f = freshById.get(r.id);
    if (f) { seen.add(r.id); return { ...r, achieved: f.achieved }; }
    return r;
  });
  for (const f of fresh) if (!seen.has(f.id)) merged.push(f);
  return merged;
}

// Ververst `achieved` van specifieke rijen op basis van hun campagnelabel (niet hun id) —
// voor live gekoppelde kanalen zoals LinkedIn (/api/linkedin/campaigns), waar de respons al
// precies de bekende campagnelabels als sleutel teruggeeft. Rijen van andere kanalen, en rijen
// waarvan het label niet in `achievedByLabel` voorkomt, blijven ongemoeid.
export function applyAchievedByLabel(
  rows: ChannelResultRow[],
  kanaal: string,
  achievedByLabel: Record<string, SpendVolumes>,
): ChannelResultRow[] {
  return rows.map((r) => {
    if (r.kanaal !== kanaal) return r;
    const fresh = achievedByLabel[r.campagne];
    return fresh ? { ...r, achieved: fresh } : r;
  });
}

export function groupByKanaal(rows: CampaignRow[]): GroupedEntity[] {
  const byPlatform = new Map<Platform, CampaignRow[]>();
  for (const r of rows) {
    const list = byPlatform.get(r.platform);
    if (list) list.push(r); else byPlatform.set(r.platform, [r]);
  }
  return [...byPlatform.entries()].map(([platform, groupRows]) => ({
    label: PLATFORM_LABEL[platform],
    metrics: sumSpendVolumes(groupRows.map(rowToSpendVolumes)),
  }));
}
