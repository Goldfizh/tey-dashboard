'use client';

import { useState, useEffect } from 'react';
import type { MetaDetailRow } from '@/lib/meta-detail';
import { BarCard, ComboCard, ChartSkeleton } from './ChartCards';

const fmtEur = (v: number) =>
  v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum = (v: number) => v.toLocaleString('nl-NL');
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Aggregation helpers ──────────────────────────────────────────────────────

interface DailyRow {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpc: number;
  cpa: number;
}

interface AudienceRow {
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpa: number;
  conv_pct: number;
}

interface AdRow {
  ad_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpa: number;
  conv_pct: number;
  cpc: number;
  ctr: number;
}

function aggregateDaily(rows: MetaDetailRow[]): DailyRow[] {
  const map = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number }>();
  for (const r of rows) {
    const cur = map.get(r.date) ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    cur.spend       += r.spend;
    cur.clicks      += r.clicks;
    cur.impressions += r.impressions;
    cur.conversions += r.conversions;
    map.set(r.date, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      spend:       v.spend,
      clicks:      v.clicks,
      impressions: v.impressions,
      conversions: v.conversions,
      cpc:         v.clicks      > 0 ? v.spend / v.clicks      : 0,
      cpa:         v.conversions > 0 ? v.spend / v.conversions : 0,
    }));
}

function aggregateByAudience(rows: MetaDetailRow[]): AudienceRow[] {
  const map = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number }>();
  for (const r of rows) {
    const key = r.campaign_name;
    const cur = map.get(key) ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    cur.spend       += r.spend;
    cur.clicks      += r.clicks;
    cur.impressions += r.impressions;
    cur.conversions += r.conversions;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([campaign_name, v]) => ({
    campaign_name,
    spend:       v.spend,
    clicks:      v.clicks,
    impressions: v.impressions,
    conversions: v.conversions,
    cpa:         v.conversions > 0 ? v.spend   / v.conversions : 0,
    conv_pct:    v.clicks      > 0 ? v.conversions / v.clicks * 100 : 0,
  }));
}

function aggregateByAd(rows: MetaDetailRow[]): AdRow[] {
  const map = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number }>();
  for (const r of rows) {
    const key = `${r.campaign_name} · ${r.platform}`;
    const cur = map.get(key) ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    cur.spend       += r.spend;
    cur.clicks      += r.clicks;
    cur.impressions += r.impressions;
    cur.conversions += r.conversions;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([ad_name, v]) => ({
    ad_name,
    spend:       v.spend,
    clicks:      v.clicks,
    impressions: v.impressions,
    conversions: v.conversions,
    cpa:         v.conversions > 0 ? v.spend        / v.conversions : 0,
    conv_pct:    v.clicks      > 0 ? v.conversions  / v.clicks * 100 : 0,
    cpc:         v.clicks      > 0 ? v.spend        / v.clicks : 0,
    ctr:         v.impressions > 0 ? v.clicks       / v.impressions * 100 : 0,
  }));
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

export default function MetaSection({ dateFrom, dateTo }: Props) {
  const [rows,    setRows]    = useState<MetaDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/meta-detail')
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<MetaDetailRow[]>;
      })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered   = rows.filter((r) =>
    (!dateFrom || r.date >= dateFrom) &&
    (!dateTo   || r.date <= dateTo)
  );

  const daily      = aggregateDaily(filtered);
  const byAudience = aggregateByAudience(filtered);
  const byAd       = aggregateByAd(filtered);

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Meta</h2>

      {error && (
        <p className="text-sm text-red-600 mb-4">Fout bij laden: {error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600">Campagneresultaten per dag</h3>

          {loading ? (
            <><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /></>
          ) : (
            <>
              <ComboCard
                title="Conversies & CPA per dag"
                data={daily as unknown as Record<string, unknown>[]}
                xKey="date"
                barKey="conversions"
                lineKey="cpa"
                barLabel="Conversies"
                lineLabel="CPA"
                barColor="#2563EB"
                lineColor="#9ca3af"
                barFormat={fmtNum}
                lineFormat={fmtEur}
                xAngle={-45}
              />
              <ComboCard
                title="Clicks & CPC per dag"
                data={daily as unknown as Record<string, unknown>[]}
                xKey="date"
                barKey="clicks"
                lineKey="cpc"
                barLabel="Clicks"
                lineLabel="CPC"
                barColor="#2563EB"
                lineColor="#9ca3af"
                barFormat={fmtNum}
                lineFormat={fmtEur}
                xAngle={-45}
              />
              <BarCard
                title="Spend per dag"
                data={daily as unknown as Record<string, unknown>[]}
                xKey="date"
                valueKey="spend"
                color="#2563EB"
                format={fmtEur}
                xAngle={-45}
              />
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600">Doelgroep- &amp; advertentieresultaten</h3>

          {loading ? (
            <><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /></>
          ) : (
            <>
              <BarCard
                title="CPA per doelgroep"
                data={byAudience as unknown as Record<string, unknown>[]}
                xKey="campaign_name"
                valueKey="cpa"
                color="#2563EB"
                format={fmtEur}
                showLabels
                xAngle={-45}
              />
              <BarCard
                title="Conversie% per doelgroep"
                data={byAudience as unknown as Record<string, unknown>[]}
                xKey="campaign_name"
                valueKey="conv_pct"
                color="#F87171"
                format={fmtPct}
                showLabels
                xAngle={-45}
              />
              <BarCard
                title="CPA per advertentie"
                data={byAd as unknown as Record<string, unknown>[]}
                xKey="ad_name"
                valueKey="cpa"
                color="#2563EB"
                format={fmtEur}
                showLabels
                xAngle={-45}
              />
              <BarCard
                title="Conversie% per advertentie"
                data={byAd as unknown as Record<string, unknown>[]}
                xKey="ad_name"
                valueKey="conv_pct"
                color="#F87171"
                format={fmtPct}
                showLabels
                xAngle={-45}
              />
              <BarCard
                title="CPC per advertentie"
                data={byAd as unknown as Record<string, unknown>[]}
                xKey="ad_name"
                valueKey="cpc"
                color="#2563EB"
                format={fmtEur}
                showLabels
                xAngle={-45}
              />
              <BarCard
                title="CTR per advertentie"
                data={byAd as unknown as Record<string, unknown>[]}
                xKey="ad_name"
                valueKey="ctr"
                color="#F87171"
                format={fmtPct}
                showLabels
                xAngle={-45}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
