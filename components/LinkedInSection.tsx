'use client';

import { useState, useEffect } from 'react';
import type { LinkedInDetailRow } from '@/lib/linkedin-detail';
import { BarCard, ComboCard, ChartSkeleton } from './ChartCards';

const fmtEur = (v: number) =>
  v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum = (v: number) => v.toLocaleString('nl-NL');

// ── Aggregation helpers ──────────────────────────────────────────────────────

interface DailyRow {
  date: string;
  spend: number;
  clicks: number;
  conversions: number;
  cpc: number;
  cpa: number;
}

interface CampaignRow {
  campaign_id: string;
  spend: number;
  clicks: number;
  conversions: number;
  cpc: number;
  cpa: number;
}

function aggregateDaily(rows: LinkedInDetailRow[]): DailyRow[] {
  const map = new Map<string, { spend: number; clicks: number; conversions: number }>();
  for (const r of rows) {
    const cur = map.get(r.date) ?? { spend: 0, clicks: 0, conversions: 0 };
    cur.spend       += r.spend;
    cur.clicks      += r.clicks;
    cur.conversions += r.conversions;
    map.set(r.date, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      spend:       v.spend,
      clicks:      v.clicks,
      conversions: v.conversions,
      cpc:         v.clicks      > 0 ? v.spend / v.clicks      : 0,
      cpa:         v.conversions > 0 ? v.spend / v.conversions : 0,
    }));
}

function aggregateByCampaign(rows: LinkedInDetailRow[]): CampaignRow[] {
  const map = new Map<string, { spend: number; clicks: number; conversions: number }>();
  for (const r of rows) {
    const cur = map.get(r.campaign_id) ?? { spend: 0, clicks: 0, conversions: 0 };
    cur.spend       += r.spend;
    cur.clicks      += r.clicks;
    cur.conversions += r.conversions;
    map.set(r.campaign_id, cur);
  }
  return Array.from(map.entries()).map(([campaign_id, v]) => ({
    campaign_id,
    spend:       v.spend,
    clicks:      v.clicks,
    conversions: v.conversions,
    cpc:         v.clicks      > 0 ? v.spend / v.clicks      : 0,
    cpa:         v.conversions > 0 ? v.spend / v.conversions : 0,
  }));
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

export default function LinkedInSection({ dateFrom, dateTo }: Props) {
  const [rows,    setRows]    = useState<LinkedInDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/linkedin-detail')
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<LinkedInDetailRow[]>;
      })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) =>
    (!dateFrom || r.date >= dateFrom) &&
    (!dateTo   || r.date <= dateTo)
  );

  const daily    = aggregateDaily(filtered);
  const byCamp   = aggregateByCampaign(filtered);

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">LinkedIn</h2>

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
              <BarCard
                title="Spend per dag"
                data={daily as unknown as Record<string, unknown>[]}
                xKey="date"
                valueKey="spend"
                color="#2563EB"
                format={fmtEur}
                xAngle={-45}
              />
              <ComboCard
                title="Clicks & CPC per dag"
                data={daily as unknown as Record<string, unknown>[]}
                xKey="date"
                barKey="clicks"
                lineKey="cpc"
                barLabel="Clicks"
                lineLabel="Gem. CPC"
                barColor="#2563EB"
                lineColor="#9ca3af"
                barFormat={fmtNum}
                lineFormat={fmtEur}
                xAngle={-45}
              />
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
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600">Doelgroepresultaten</h3>

          {loading ? (
            <ChartSkeleton />
          ) : (
            <BarCard
              title="CPC per doelgroep"
              data={byCamp as unknown as Record<string, unknown>[]}
              xKey="campaign_id"
              valueKey="cpc"
              color="#2563EB"
              format={fmtEur}
              showLabels
              xAngle={-45}
            />
          )}
        </div>
      </div>
    </section>
  );
}
