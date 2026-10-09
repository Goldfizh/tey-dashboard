// Directe koppeling met de Meta Marketing API (Graph API, /insights), los van de Google Sheets-
// export (die alleen dag-data van 3 april t/m 2 juni 2026 bevat — niet de huidige Q4-periode) en
// los van de handmatige META_ACHIEVED-snapshot die hiervoor in lib/seedKpiTargets.ts stond. Zelfde
// aanpak als lib/linkedin.ts: gescopet op een vaste lijst campagne-ID's (zie META_CAMPAIGNS in
// lib/seedKpiTargets.ts), niet "haal alle Meta-campagnes op".
//
// Vereiste env vars: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (zonder "act_"-prefix — die wordt hier
// toegevoegd). Graph/Marketing API-versie: v26.0 (nieuwste op 2026-10-09, zie
// https://developers.facebook.com/docs/graph-api/changelog/version26.0).

import type { AchievedMetrics } from '@/types/results';
import type { CampaignRow } from '@/types/campaign';

const META_API_VERSION = 'v26.0';

export interface MetaCampaignResult {
  campaignId: string;
  achieved: AchievedMetrics;
}

interface MetaInsightRow {
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
  date_start?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function actionValue(actions: MetaInsightRow['actions'], type: string): number {
  const match = actions?.find((a) => a.action_type === type);
  return match ? Number(match.value) : 0;
}

// `video_view` = Meta's 3-seconden-view-actie, dezelfde proxy voor "voltooide view" die ook al
// gebruikt werd in de handmatige META_ACHIEVED-snapshot (geen exacte thruplay-telling, zie
// lib/seedKpiTargets.ts). `lead` = de conversieactie; staat tot nu toe altijd op 0 in de snapshot
// omdat er nog geen sollicitatie-actie is binnengekomen.
async function fetchMetaInsights(campaignIds: string[], start: Date, end: Date, daily: boolean): Promise<MetaInsightRow[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const accountRaw = process.env.META_AD_ACCOUNT_ID;
  if (!token) throw new Error('Missing META_ACCESS_TOKEN env var');
  if (!accountRaw) throw new Error('Missing META_AD_ACCOUNT_ID env var');
  if (campaignIds.length === 0) return [];

  const account = accountRaw.startsWith('act_') ? accountRaw : `act_${accountRaw}`;
  const fields = ['campaign_id', 'spend', 'impressions', 'clicks', 'reach', 'actions', 'date_start'].join(',');
  const filtering = JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]);
  const timeRange = JSON.stringify({ since: ymd(start), until: ymd(end) });

  const params = new URLSearchParams({
    level: 'campaign',
    fields,
    filtering,
    time_range: timeRange,
    limit: '500',
    access_token: token,
  });
  if (daily) params.set('time_increment', '1');

  let url: string | undefined = `https://graph.facebook.com/${META_API_VERSION}/${account}/insights?${params.toString()}`;
  const rows: MetaInsightRow[] = [];
  // Insights kunnen gepagineerd terugkomen (bv. 4 campagnes x 60 dagen > default page size) —
  // volg `paging.next` tot er geen volgende pagina meer is.
  while (url) {
    const res: Response = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API error ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { data?: MetaInsightRow[]; paging?: { next?: string } };
    rows.push(...(data.data ?? []));
    url = data.paging?.next;
  }
  return rows;
}

// Haalt achieved-cijfers op voor een vaste set Meta-campagne-ID's, gescopet op één periode
// (totaal, niet per dag) — voor Totaaloverzicht/Kanalen se "Resultaten"-samenvatting.
export async function getMetaCampaignResults(campaignIds: string[], start: Date, end: Date): Promise<MetaCampaignResult[]> {
  const rows = await fetchMetaInsights(campaignIds, start, end, false);
  return rows.flatMap((r): MetaCampaignResult[] => {
    if (!r.campaign_id) return [];
    return [{
      campaignId: r.campaign_id,
      achieved: {
        spend: Number(r.spend ?? 0),
        volumes: {
          impressions: Number(r.impressions ?? 0),
          reach: Number(r.reach ?? 0),
          clicks: Number(r.clicks ?? 0),
          completedViews: actionValue(r.actions, 'video_view'),
          conversions: actionValue(r.actions, 'lead'),
        },
      },
    }];
  });
}

// Haalt per-dag cijfers op, al omgezet naar CampaignRow[] met `campaign_name` = het korte label
// (EB video/Skill video/...) — zodat deze rijen, eenmaal gemerged in app/page.tsx's `rows`-state,
// via dezelfde buildRawGroups/buildDailyEntities (lib/resultsAdapter.ts) als de LinkedIn-data lopen
// en de dag-niveau-grafieken/tabellen in het blad Kanalen meteen met échte Meta-cijfers vullen voor
// de geselecteerde campagne(s).
export async function getMetaDailyRows(campaignIdToLabel: Record<string, string>, start: Date, end: Date): Promise<CampaignRow[]> {
  const campaignIds = Object.keys(campaignIdToLabel);
  const rows = await fetchMetaInsights(campaignIds, start, end, true);

  return rows.flatMap((r): CampaignRow[] => {
    const label = r.campaign_id ? campaignIdToLabel[r.campaign_id] : undefined;
    const date = r.date_start;
    if (!label || !date) return [];
    return [{
      platform: 'meta',
      campaign_name: label,
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      spend: Number(r.spend ?? 0),
      conversions: actionValue(r.actions, 'lead'),
      reach: Number(r.reach ?? 0),
      thruplays: actionValue(r.actions, 'video_view'),
      date,
    }];
  });
}
