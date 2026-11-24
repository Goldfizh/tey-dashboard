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

interface MetaAction { action_type: string; value: string }

interface MetaInsightRow {
  campaign_id?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: MetaAction[];
  video_thruplay_watched_actions?: MetaAction[];
  date_start?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function actionValue(actions: MetaAction[] | undefined, type: string): number {
  const match = actions?.find((a) => a.action_type === type);
  return match ? Number(match.value) : 0;
}

// Per lead-campagne (zie META_CAMPAIGNS) het echte custom-conversion-ID dat bij die campagne hoort
// — NIET hetzelfde event voor alle leadcampagnes. Ontdekt op 2026-11-24 bij het uitzoeken van een
// Meta Ads Manager-export (met per-event-naam kolommen) naast de live API: de generieke aanpak die
// hier eerder stond (spend ÷ cost_per_action_type's "submit_application"-bucket) bleek impliciet
// altijd "Sollicitatie_voltooid_recruitee_1" te pakken (Meta's eigen SUBMIT_APPLICATION-categorie,
// zie act_.../customconversions), ook voor Informatieavond — terwijl dat event daar he­lemaal niet
// de juiste KPI is: die campagne wil "Aanmelding_afgerond_informatieavond" (bevestigde aanmelding
// voor de informatieavond), een apart, eigen custom-conversion-event. Vandaar nu per campagne-ID
// het juiste event expliciet, en rechtstreeks geteld via `actions` (geen afgeleide deling meer).
const LEAD_EVENT_BY_CAMPAIGN: Record<string, string> = {
  '120223179012160642': '1439285254624385', // Informatieavond -> Aanmelding_afgerond_informatieavond
  '120241528532830642': '1500800018510624', // Vacatures -> Sollicitatie_voltooid_recruitee_1
};

function leadConversions(campaignId: string | undefined, actions: MetaAction[] | undefined): number {
  const customConversionId = campaignId ? LEAD_EVENT_BY_CAMPAIGN[campaignId] : undefined;
  if (!customConversionId) return 0;
  return actionValue(actions, `offsite_conversion.custom.${customConversionId}`);
}

function achievedFromRow(r: MetaInsightRow): AchievedMetrics {
  return {
    spend: Number(r.spend ?? 0),
    volumes: {
      impressions: Number(r.impressions ?? 0),
      reach: Number(r.reach ?? 0),
      clicks: Number(r.clicks ?? 0),
      // ThruPlay (15 sec, `video_thruplay_watched_actions`) — Meta's eigen "Resultaten"-indicator
      // voor de video-campagnes (geverifieerd via Ads Manager-export 2026-11-24), een eigen
      // Insights-veld los van `actions`. Vervangt de eerdere 3-seconden `video_view`-proxy (minder
      // nauwkeurig, en niet wat het mediaplan's CPCV-target bedoelde).
      completedViews: actionValue(r.video_thruplay_watched_actions, 'video_view'),
      conversions: leadConversions(r.campaign_id, r.actions),
    },
  };
}

const BASE_FIELDS = ['campaign_id', 'spend', 'impressions', 'clicks', 'reach', 'actions', 'video_thruplay_watched_actions'];

async function fetchMetaInsights(
  campaignIds: string[],
  start: Date,
  end: Date,
  opts: { level: 'campaign' | 'adset' | 'ad'; daily?: boolean },
): Promise<MetaInsightRow[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const accountRaw = process.env.META_AD_ACCOUNT_ID;
  if (!token) throw new Error('Missing META_ACCESS_TOKEN env var');
  if (!accountRaw) throw new Error('Missing META_AD_ACCOUNT_ID env var');
  if (campaignIds.length === 0) return [];

  const account = accountRaw.startsWith('act_') ? accountRaw : `act_${accountRaw}`;
  const extraFields =
    opts.level === 'adset' ? ['adset_id', 'adset_name']
    : opts.level === 'ad' ? ['adset_id', 'ad_id', 'ad_name']
    : ['date_start'];
  const fields = [...BASE_FIELDS, ...extraFields].join(',');
  const filtering = JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]);
  const timeRange = JSON.stringify({ since: ymd(start), until: ymd(end) });

  const params = new URLSearchParams({
    level: opts.level,
    fields,
    filtering,
    time_range: timeRange,
    limit: '500',
    access_token: token,
  });
  if (opts.daily) params.set('time_increment', '1');

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
  const rows = await fetchMetaInsights(campaignIds, start, end, { level: 'campaign' });
  return rows.flatMap((r): MetaCampaignResult[] => {
    if (!r.campaign_id) return [];
    return [{ campaignId: r.campaign_id, achieved: achievedFromRow(r) }];
  });
}

// Haalt per-dag cijfers op, al omgezet naar CampaignRow[] met `campaign_name` = het korte label
// (EB video/Skill video/.../Vacatures/Informatieavond) — zodat deze rijen, eenmaal gemerged in
// app/page.tsx's `rows`-state, via dezelfde buildRawGroups/buildDailyEntities (lib/resultsAdapter.ts)
// als de LinkedIn-data lopen en de dag-niveau-grafieken/tabellen in het blad Kanalen meteen met
// échte Meta-cijfers vullen voor de geselecteerde campagne(s).
export async function getMetaDailyRows(campaignIdToLabel: Record<string, string>, start: Date, end: Date): Promise<CampaignRow[]> {
  const campaignIds = Object.keys(campaignIdToLabel);
  const rows = await fetchMetaInsights(campaignIds, start, end, { level: 'campaign', daily: true });

  return rows.flatMap((r): CampaignRow[] => {
    const label = r.campaign_id ? campaignIdToLabel[r.campaign_id] : undefined;
    const date = r.date_start;
    if (!label || !date) return [];
    const achieved = achievedFromRow(r);
    return [{
      platform: 'meta',
      campaign_name: label,
      impressions: achieved.volumes.impressions,
      clicks: achieved.volumes.clicks,
      spend: achieved.spend,
      conversions: achieved.volumes.conversions,
      reach: achieved.volumes.reach,
      thruplays: achieved.volumes.completedViews,
      date,
    }];
  });
}

export interface MetaBreakdownRow {
  campaignId: string;
  id: string;
  name: string;
  achieved: AchievedMetrics;
}

// Doelgroep- (advertentieset-) en advertentieniveau, live — vervangt de voormalige handmatige
// META_DRILLDOWN-snapshot (lib/seedDrilldown.ts, verwijderd). Rechtstreeks via de Graph API kunnen
// adset_name/ad_name wél direct opgevraagd worden (in tegenstelling tot de eerder gebruikte
// chat-connector, die op dit niveau geen namen teruggaf) — geen giswerk meer nodig over welke naam
// bij welk getal hoort. Gescopet op exact de meegegeven campagne-ID's, dus de aanroeper (Kanalen)
// bepaalt welke campagne(s) data opleveren door alleen de geselecteerde campagne-ID's mee te geven.
export async function getMetaBreakdown(campaignIds: string[], start: Date, end: Date, level: 'adset' | 'ad'): Promise<MetaBreakdownRow[]> {
  const rows = await fetchMetaInsights(campaignIds, start, end, { level });
  return rows.flatMap((r): MetaBreakdownRow[] => {
    const id = level === 'adset' ? r.adset_id : r.ad_id;
    const name = level === 'adset' ? r.adset_name : r.ad_name;
    if (!r.campaign_id || !id) return [];
    return [{ campaignId: r.campaign_id, id, name: name ?? id, achieved: achievedFromRow(r) }];
  });
}
