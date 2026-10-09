// Directe koppeling met de LinkedIn Marketing API (Ad Analytics), los van de Google Sheets-
// export. Gescopet op een vaste lijst campagne-ID's (zie LINKEDIN_CAMPAIGNS in
// lib/seedKpiTargets.ts) — bewust geen "haal alles op"-aanroep, om niet opnieuw het probleem van
// de Sheets-feed te krijgen (die bevatte alle actieve campagnes, niet alleen de 3 die we volgen).
//
// Vereiste env vars: LINKEDIN_ACCESS_TOKEN (verplicht). LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET/
// LINKEDIN_REFRESH_TOKEN staan ook klaar maar worden hier nog niet gebruikt — het access token is
// 2 maanden geldig (zie LinkedIn Developer Portal), dat is voorlopig genoeg. Als het ooit verloopt
// moet er handmatig een nieuw access token gegenereerd worden (zelfde OAuth-stap als de eerste
// keer) tot hier automatische refresh-logica aan toegevoegd wordt.
//
// LET OP: dit is nog niet live getest tegen de echte LinkedIn API — er is geen werkend token
// beschikbaar in de omgeving waar deze code geschreven is. Bij de eerste echte aanroep kan de
// exacte vorm van de query (Rest.li-syntax) nog aanpassing nodig hebben; zie de foutmelding die
// /api/linkedin/campaigns teruggeeft (die bevat de ruwe LinkedIn-foutrespons, niet alleen "faalde").

import type { AchievedMetrics } from '@/types/results';

const LINKEDIN_API_VERSION = '202410'; // LinkedIn-Version header (YYYYMM) — LinkedIn verplicht dit en ververst de ondersteunde versies periodiek

export interface LinkedInCampaignResult {
  campaignId: string;
  achieved: AchievedMetrics;
}

function ymd(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function buildAnalyticsUrl(campaignIds: string[], start: Date, end: Date): string {
  const s = ymd(start);
  const e = ymd(end);
  const dateRange = `(start:(year:${s.year},month:${s.month},day:${s.day}),end:(year:${e.year},month:${e.month},day:${e.day}))`;
  const campaignsList = `List(${campaignIds.map((id) => encodeURIComponent(`urn:li:sponsoredCampaign:${id}`)).join(',')})`;
  const fields = ['impressions', 'clicks', 'costInLocalCurrency', 'externalWebsiteConversions', 'approximateMemberReach'].join(',');

  const params = [
    'q=analytics',
    'pivot=CAMPAIGN',
    'timeGranularity=ALL',
    `dateRange=${encodeURIComponent(dateRange)}`,
    `campaigns=${campaignsList}`,
    `fields=${fields}`,
  ].join('&');

  return `https://api.linkedin.com/rest/adAnalytics?${params}`;
}

// Haalt achieved-cijfers op voor een vaste set LinkedIn-campagne-ID's, gescopet op één periode.
// Gooit een Error met de ruwe LinkedIn-foutrespons als er iets misgaat (verlopen token, verkeerde
// query-vorm, ontbrekende rechten, etc.) — die tekst is bedoeld om direct te kunnen debuggen.
export async function getLinkedInCampaignResults(campaignIds: string[], start: Date, end: Date): Promise<LinkedInCampaignResult[]> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) throw new Error('Missing LINKEDIN_ACCESS_TOKEN env var');
  if (campaignIds.length === 0) return [];

  const url = buildAnalyticsUrl(campaignIds, start, end);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    // Analytics-cijfers veranderen gedurende de dag — niet laten cachen door Next.js.
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { elements?: Record<string, unknown>[] };

  return (data.elements ?? []).map((el) => {
    const pivotValue = String(el.pivotValue ?? '');
    const campaignId = pivotValue.split(':').pop() ?? '';
    return {
      campaignId,
      achieved: {
        spend: Number(el.costInLocalCurrency ?? 0),
        volumes: {
          impressions: Number(el.impressions ?? 0),
          clicks: Number(el.clicks ?? 0),
          reach: Number(el.approximateMemberReach ?? 0),
          conversions: Number(el.externalWebsiteConversions ?? 0),
        },
      },
    };
  });
}
