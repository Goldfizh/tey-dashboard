// Directe koppeling met de Google Ads API (v25) voor de 3 bekende YouTube/VIDEO-campagnes (zie
// YOUTUBE_CAMPAIGNS in lib/seedKpiTargets.ts) — zelfde aanpak als lib/meta.ts/lib/linkedin.ts:
// gescopet op een vaste lijst campagne-ID's, niet "haal alle Google Ads-campagnes op" (dit account
// heeft ook Search-campagnes die niets met YouTube te maken hebben).
//
// `completedViews` komt van `metrics.interactions`, niet van een los "video_views"-veld — dat veld
// gaf "UNRECOGNIZED_FIELD" terug bij direct uitproberen (2026-11-27), vermoedelijk een beperking
// van dit developer-token/deze API-toegang. `interactions` is Google Ads' kanaalonafhankelijke
// "belangrijkste interactie"-metric; voor een VIDEO-campagne is dat de video-view (bevestigd: de
// meegeleverde interactionRate kwam exact overeen met interactions/impressions voor de bekende
// campagnes — consistent met "interactions = views" voor dit campagnetype).
//
// Vereiste env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (OAuth, voor een
// toegangstoken), GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID (klantaccount, zonder
// streepjes), GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC-manageraccount — alleen nodig als het klantaccount
// onder een manager hangt).

import type { AchievedMetrics } from '@/types/results';
import type { CampaignRow } from '@/types/campaign';

const API_VERSION = 'v25';

export interface YoutubeCampaignResult {
  campaignId: string;
  achieved: AchievedMetrics;
}

interface GoogleAdsMetrics {
  costMicros?: string;
  impressions?: string;
  clicks?: string;
  interactions?: string;
}

interface GoogleAdsRow {
  campaign?: { id?: string };
  metrics?: GoogleAdsMetrics;
  segments?: { date?: string };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId) throw new Error('Missing GOOGLE_CLIENT_ID env var');
  if (!clientSecret) throw new Error('Missing GOOGLE_CLIENT_SECRET env var');
  if (!refreshToken) throw new Error('Missing GOOGLE_REFRESH_TOKEN env var');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth token-refresh error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function achievedFromRow(r: GoogleAdsRow): AchievedMetrics {
  return {
    spend: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
    volumes: {
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      completedViews: Number(r.metrics?.interactions ?? 0),
      reach: 0,
      conversions: 0,
    },
  };
}

async function fetchGoogleAdsRows(campaignIds: string[], start: Date, end: Date, daily: boolean): Promise<GoogleAdsRow[]> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!customerId) throw new Error('Missing GOOGLE_ADS_CUSTOMER_ID env var');
  if (!developerToken) throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN env var');
  if (campaignIds.length === 0) return [];

  const accessToken = await getAccessToken();
  const fields = ['campaign.id', 'metrics.cost_micros', 'metrics.impressions', 'metrics.clicks', 'metrics.interactions'];
  if (daily) fields.push('segments.date');
  const query = `SELECT ${fields.join(', ')} FROM campaign WHERE campaign.id IN (${campaignIds.join(',')}) AND segments.date BETWEEN '${ymd(start)}' AND '${ymd(end)}'`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

  const rows: GoogleAdsRow[] = [];
  let pageToken: string | undefined;
  do {
    const res: Response = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, pageSize: 10000, pageToken }),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Ads API error ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { results?: GoogleAdsRow[]; nextPageToken?: string };
    rows.push(...(data.results ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return rows;
}

// Haalt achieved-cijfers op voor een vaste set YouTube-campagne-ID's, gescopet op één periode
// (totaal, niet per dag) — voor Totaaloverzicht/Kanalen se "Resultaten"-samenvatting.
export async function getYoutubeCampaignResults(campaignIds: string[], start: Date, end: Date): Promise<YoutubeCampaignResult[]> {
  const rows = await fetchGoogleAdsRows(campaignIds, start, end, false);
  return rows.flatMap((r): YoutubeCampaignResult[] => {
    if (!r.campaign?.id) return [];
    return [{ campaignId: r.campaign.id, achieved: achievedFromRow(r) }];
  });
}

// Haalt per-dag cijfers op, al omgezet naar CampaignRow[] met `campaign_name` = het korte label
// (EB video/Skill video/Extra video) — zelfde vorm als getMetaDailyRows/getLinkedInDailyRows, zodat
// deze rijen na het mergen in app/page.tsx's `rows`-state meteen door de bestaande dag-niveau-
// grafieken/tabellen in Kanalen lopen.
export async function getYoutubeDailyRows(campaignIdToLabel: Record<string, string>, start: Date, end: Date): Promise<CampaignRow[]> {
  const campaignIds = Object.keys(campaignIdToLabel);
  const rows = await fetchGoogleAdsRows(campaignIds, start, end, true);

  return rows.flatMap((r): CampaignRow[] => {
    const label = r.campaign?.id ? campaignIdToLabel[r.campaign.id] : undefined;
    const date = r.segments?.date;
    if (!label || !date) return [];
    const achieved = achievedFromRow(r);
    return [{
      platform: 'youtube',
      campaign_name: label,
      impressions: achieved.volumes.impressions,
      clicks: achieved.volumes.clicks,
      spend: achieved.spend,
      conversions: 0,
      reach: 0,
      thruplays: achieved.volumes.completedViews,
      date,
    }];
  });
}
