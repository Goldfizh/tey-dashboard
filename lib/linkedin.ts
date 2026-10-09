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
// Live geprobeerd op 2026-10-09: authenticatie werkte (geen 401). Twee pogingen gaven allebei
// exact dezelfde "ILLEGAL_ARGUMENT: Invalid query parameters" terug — zowel met `campaigns=List(...)`
// als met de geïndexeerde array-vorm `campaigns[0]=...`. Omdat de fout bij een fundamenteel andere
// array-encoding identiek bleef, ligt de oorzaak vermoedelijk niet bij `campaigns`. Sterkste
// kandidaat: `approximateMemberReach` — een bekend LinkedIn-API-veld dat niet gecombineerd mag
// worden met de meeste andere metrics in dezelfde aanvraag. Hieronder verwijderd; `reach` blijft
// daardoor voorlopig op 0 voor LinkedIn. `campaigns` staat terug op `List(...)`, de Rest.li
// 2.0.0-standaardvorm die hoort bij de `X-Restli-Protocol-Version: 2.0.0`-header die we al sturen.

import type { AchievedMetrics } from '@/types/results';
import type { CampaignRow } from '@/types/campaign';

const LINKEDIN_API_VERSION = '202609'; // LinkedIn-Version header (YYYYMM) — LinkedIn verplicht dit en ververst de ondersteunde versies periodiek

export interface LinkedInCampaignResult {
  campaignId: string;
  achieved: AchievedMetrics;
}

function ymd(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function dateFromDateRangeStart(el: Record<string, unknown>): string {
  const dr = el.dateRange as { start?: { year: number; month: number; day: number } } | undefined;
  const s = dr?.start;
  if (!s) return '';
  return `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
}

// BELANGRIJK: dateRange NIET als geheel encodeURIComponent'en — de haakjes/dubbele-punten/komma's
// zijn Rest.li's eigen compacte-object-syntax en moeten letterlijk in de query-string staan
// (zelfde principe als bij `campaigns=List(...)`: alleen de URN's erbinnen worden geëncodeerd, de
// `List(...)`-haakjes zelf niet). `approximateMemberReach` bewust niet opgevraagd — dat LinkedIn-
// veld mag niet gecombineerd worden met de meeste andere metrics in dezelfde aanvraag.
async function fetchLinkedInAnalytics(
  campaignIds: string[],
  start: Date,
  end: Date,
  timeGranularity: 'ALL' | 'DAILY',
): Promise<Record<string, unknown>[]> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) throw new Error('Missing LINKEDIN_ACCESS_TOKEN env var');
  if (campaignIds.length === 0) return [];

  const s = ymd(start);
  const e = ymd(end);
  const dateRange = `(start:(year:${s.year},month:${s.month},day:${s.day}),end:(year:${e.year},month:${e.month},day:${e.day}))`;
  const fields = ['dateRange', 'pivotValues', 'impressions', 'clicks', 'costInLocalCurrency', 'externalWebsiteConversions'].join(',');
  const campaignsList = `List(${campaignIds.map((id) => encodeURIComponent(`urn:li:sponsoredCampaign:${id}`)).join(',')})`;

  const params = [
    'q=analytics',
    'pivot=CAMPAIGN',
    `timeGranularity=${timeGranularity}`,
    `dateRange=${dateRange}`,
    `campaigns=${campaignsList}`,
    `fields=${fields}`,
  ].join('&');

  const url = `https://api.linkedin.com/rest/adAnalytics?${params}`;
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
  return data.elements ?? [];
}

function campaignIdFromElement(el: Record<string, unknown>): string {
  // Bij pivot=CAMPAIGN geeft LinkedIn "pivotValues" terug: een array met exact 1 URN erin
  // (één per rij), bv. ["urn:li:sponsoredCampaign:585205134"].
  const pivotValues = Array.isArray(el.pivotValues) ? (el.pivotValues as string[]) : [];
  return (pivotValues[0] ?? '').split(':').pop() ?? '';
}

// Haalt achieved-cijfers op voor een vaste set LinkedIn-campagne-ID's, gescopet op één periode
// (totaal, niet per dag) — voor Totaaloverzicht/Kanalen se "Resultaten"-samenvatting.
export async function getLinkedInCampaignResults(campaignIds: string[], start: Date, end: Date): Promise<LinkedInCampaignResult[]> {
  const elements = await fetchLinkedInAnalytics(campaignIds, start, end, 'ALL');
  return elements.map((el) => ({
    campaignId: campaignIdFromElement(el),
    achieved: {
      spend: Number(el.costInLocalCurrency ?? 0),
      volumes: {
        impressions: Number(el.impressions ?? 0),
        clicks: Number(el.clicks ?? 0),
        reach: 0,
        conversions: Number(el.externalWebsiteConversions ?? 0),
      },
    },
  }));
}

// Haalt per-dag cijfers op, al omgezet naar CampaignRow[] met `campaign_name` = het korte label
// (EB video/Skill video/...) — zodat deze rijen, eenmaal gemerged in app/page.tsx's `rows`-state,
// via dezelfde buildRawGroups/buildDailyEntities (lib/resultsAdapter.ts) als de Sheets-data lopen
// en de dag-niveau-grafieken/tabellen in het blad Kanalen meteen met échte LinkedIn-cijfers vullen
// voor de geselecteerde campagne(s) — geen aparte dag-databron-laag nodig.
export async function getLinkedInDailyRows(campaignIdToLabel: Record<string, string>, start: Date, end: Date): Promise<CampaignRow[]> {
  const campaignIds = Object.keys(campaignIdToLabel);
  const elements = await fetchLinkedInAnalytics(campaignIds, start, end, 'DAILY');

  return elements.flatMap((el): CampaignRow[] => {
    const campaignId = campaignIdFromElement(el);
    const label = campaignIdToLabel[campaignId];
    const date = dateFromDateRangeStart(el);
    if (!label || !date) return [];
    return [{
      platform: 'linkedin',
      campaign_name: label,
      impressions: Number(el.impressions ?? 0),
      clicks: Number(el.clicks ?? 0),
      spend: Number(el.costInLocalCurrency ?? 0),
      conversions: Number(el.externalWebsiteConversions ?? 0),
      reach: 0,
      thruplays: 0,
      date,
    }];
  });
}
