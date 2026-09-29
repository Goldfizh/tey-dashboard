export type Platform = 'linkedin' | 'meta' | 'google' | 'youtube';

export interface CampaignRow {
  platform: Platform;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  reach: number;
  thruplays: number;
  date: string; // ISO date string YYYY-MM-DD
}

export type MetricKey = 'spend' | 'impressions' | 'clicks' | 'reach' | 'conversions' | 'ctr' | 'cpc' | 'cpa';

export const METRICS: Record<MetricKey, { label: string; format: (v: number) => string }> = {
  spend:       { label: 'Spend',        format: (v) => v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) },
  impressions: { label: 'Impressions',  format: (v) => v.toLocaleString('nl-NL') },
  clicks:      { label: 'Clicks',       format: (v) => v.toLocaleString('nl-NL') },
  reach:       { label: 'Bereik',       format: (v) => v.toLocaleString('nl-NL') },
  conversions: { label: 'Sollicitanten',format: (v) => v.toLocaleString('nl-NL') },
  ctr:         { label: 'CTR',          format: (v) => `${(v * 100).toFixed(2)}%` },
  cpc:         { label: 'CPC',          format: (v) => v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) },
  cpa:         { label: 'Kosten/sollicitant', format: (v) => v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) },
};

export interface Totals {
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  thruplays: number;
  conversions: number;
}

export function getMetricValue(t: Totals, metric: MetricKey): number {
  switch (metric) {
    case 'spend':       return t.spend;
    case 'impressions': return t.impressions;
    case 'clicks':      return t.clicks;
    case 'reach':       return t.reach;
    case 'conversions': return t.conversions;
    case 'ctr':         return t.impressions > 0 ? t.clicks / t.impressions : 0;
    case 'cpc':         return t.clicks > 0 ? t.spend / t.clicks : 0;
    case 'cpa':         return t.conversions > 0 ? t.spend / t.conversions : 0;
  }
}

export function sumRows(rows: CampaignRow[]): Totals {
  return rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks:      acc.clicks      + r.clicks,
      spend:       acc.spend       + r.spend,
      reach:       acc.reach       + r.reach,
      thruplays:   acc.thruplays   + r.thruplays,
      conversions: acc.conversions + r.conversions,
    }),
    { impressions: 0, clicks: 0, spend: 0, reach: 0, thruplays: 0, conversions: 0 }
  );
}
