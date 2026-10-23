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
  cost_per_action_type?: MetaAction[];
  date_start?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function actionValue(actions: MetaAction[] | undefined, type: string): number {
  const match = actions?.find((a) => a.action_type === type);
  return match ? Number(match.value) : 0;
}

// De sollicitatie-conversie voor de lead-campagnes (Vacatures/Informatieavond, zie
// META_CAMPAIGNS) zit — contra-intuïtief — NIET in `actions`, alleen in `cost_per_action_type`
// (geverifieerd met directe Graph API-calls op 2026-10-23: de actie "offsite_submit_
// application_add_meta_leads"/"..._add_20_s_calls" ontbreekt volledig in `actions`, maar staat wél
// in `cost_per_action_type`, exact gelijk aan spend ÷ aantal — dit is kennelijk een door Meta zelf
// samengevoegde/gemodelleerde resultaatcategorie i.p.v. een letterlijke pixel-actie, vergelijkbaar
// met hoe Ads Manager's "Resultaten"-kolom werkt). Aantal conversies wordt daarom afgeleid als
// spend ÷ cost_per_action — in de 2 steekproeven was dat exact een heel getal (225.13/15.008667=15,
// 1082.87/37.340345=29). Voor de oudere campagnes (geen lead-doelstelling) staat deze actie niet in
// cost_per_action_type, dus blijft conversions daar gewoon op 0.
function submitApplicationConversions(spend: number, costPerActionType: MetaAction[] | undefined): number {
  const entry = costPerActionType?.find((a) => a.action_type.includes('submit_application'));
  const cost = entry ? Number(entry.value) : 0;
  return cost > 0 ? Math.round(spend / cost) : 0;
}

function achievedFromRow(r: MetaInsightRow): AchievedMetrics {
  const spend = Number(r.spend ?? 0);
  return {
    spend,
    volumes: {
      impressions: Number(r.impressions ?? 0),
      reach: Number(r.reach ?? 0),
      clicks: Number(r.clicks ?? 0),
      // `video_view` = Meta's 3-seconden-view-actie, dezelfde proxy voor "voltooide view" die ook
      // al gebruikt werd in de voormalige handmatige META_ACHIEVED-snapshot (geen exacte
      // thruplay-telling).
      completedViews: actionValue(r.actions, 'video_view'),
      conversions: submitApplicationConversions(spend, r.cost_per_action_type),
    },
  };
}

const BASE_FIELDS = ['campaign_id', 'spend', 'impressions', 'clicks', 'reach', 'actions', 'cost_per_action_type'];

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
