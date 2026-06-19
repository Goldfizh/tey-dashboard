'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { CampaignRow, Platform } from '@/types/campaign';

interface Props {
  /** All rows for the campaigns currently selected in the sidebar, unfiltered by date — used to derive pacing reference. */
  allRows: CampaignRow[];
  /** Date-filtered rows for the same selection — used for the actual delivery lines. */
  filteredRows: CampaignRow[];
}

type Metric = 'spend' | 'impressions';

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5',
  meta:     '#1877F2',
  google:   '#F59E0B',
};

// Distinct line colours when multiple campaigns are shown.
const PALETTE = ['#6331F4', '#0077B5', '#1877F2', '#F59E0B', '#16A34A', '#DC2626', '#9333EA', '#0EA5E9', '#F472B6', '#10B981'];

const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString('nl-NL');

function dayKey(d: string) { return d.slice(0, 10); }

export function DailyDeliveryChartSkeleton() {
  return (
    <div className="bg-white p-5 animate-pulse" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-72 bg-gray-100 rounded" />
    </div>
  );
}

export default function DailyDeliveryChart({ allRows, filteredRows }: Props) {
  const [metric, setMetric] = useState<Metric>('spend');

  // Campaigns available = unique names in current selection (sidebar filter).
  const campaigns = useMemo(() => {
    const map = new Map<string, { platform: Platform; periodSpend: number }>();
    for (const r of filteredRows) {
      const cur = map.get(r.campaign_name) ?? { platform: r.platform, periodSpend: 0 };
      cur.periodSpend += r.spend;
      map.set(r.campaign_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.periodSpend - a.periodSpend);
  }, [filteredRows]);

  // Default: top 3 by spend; reset when the campaign universe changes.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPicked((prev) => {
      const valid = new Set([...prev].filter((c) => campaigns.some((x) => x.name === c)));
      if (valid.size > 0) return valid;
      return new Set(campaigns.slice(0, 3).map((c) => c.name));
    });
  }, [campaigns]);

  // For each picked campaign: collect all-time min/max date and all-time total, for pacing reference.
  const meta = useMemo(() => {
    const m = new Map<string, { platform: Platform; minDate: string; maxDate: string; allSpend: number; allImpr: number }>();
    for (const r of allRows) {
      if (!picked.has(r.campaign_name)) continue;
      const cur = m.get(r.campaign_name);
      if (!cur) {
        m.set(r.campaign_name, { platform: r.platform, minDate: r.date, maxDate: r.date, allSpend: r.spend, allImpr: r.impressions });
      } else {
        if (r.date < cur.minDate) cur.minDate = r.date;
        if (r.date > cur.maxDate) cur.maxDate = r.date;
        cur.allSpend += r.spend;
        cur.allImpr  += r.impressions;
      }
    }
    return m;
  }, [allRows, picked]);

  // Build chart data: one row per day with per-campaign actual + per-campaign pacing reference.
  const data = useMemo(() => {
    if (picked.size === 0) return [];
    const days = new Set<string>();
    for (const r of filteredRows) if (picked.has(r.campaign_name)) days.add(dayKey(r.date));
    const sorted = Array.from(days).sort();

    // Pacing reference per campaign = totalAll / runtimeDays (constant horizontal line, only drawn within runtime).
    const pacing = new Map<string, number | null>();
    for (const [name, info] of meta.entries()) {
      const start = new Date(info.minDate + 'T00:00:00').getTime();
      const end   = new Date(info.maxDate + 'T00:00:00').getTime();
      const days  = Math.max(1, (end - start) / 86_400_000 + 1);
      const total = metric === 'spend' ? info.allSpend : info.allImpr;
      pacing.set(name, total > 0 ? total / days : null);
    }

    // Aggregate filtered rows by day × campaign.
    const dayMap = new Map<string, Map<string, number>>();
    for (const r of filteredRows) {
      if (!picked.has(r.campaign_name)) continue;
      const k = dayKey(r.date);
      if (!dayMap.has(k)) dayMap.set(k, new Map());
      const inner = dayMap.get(k)!;
      const v = metric === 'spend' ? r.spend : r.impressions;
      inner.set(r.campaign_name, (inner.get(r.campaign_name) ?? 0) + v);
    }

    return sorted.map((d) => {
      const point: Record<string, unknown> = { date: d };
      const inner = dayMap.get(d);
      for (const name of picked) {
        point[`v_${name}`] = inner?.get(name) ?? 0;
        const dayMs = new Date(d + 'T00:00:00').getTime();
        const info = meta.get(name);
        const inRuntime = info
          ? dayMs >= new Date(info.minDate + 'T00:00:00').getTime() &&
            dayMs <= new Date(info.maxDate + 'T00:00:00').getTime()
          : false;
        point[`p_${name}`] = inRuntime ? pacing.get(name) ?? null : null;
      }
      return point;
    });
  }, [filteredRows, picked, meta, metric]);

  const colorFor = (name: string) => {
    const idx = [...picked].indexOf(name);
    return PALETTE[idx % PALETTE.length];
  };

  const fmt = metric === 'spend' ? fmtEur : fmtNum;
  const metricLabel = metric === 'spend' ? 'Spend' : 'Impressies';

  function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; color: string; dataKey: string }[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;
    // Group actual vs pacing
    const actuals = payload.filter((p) => p.dataKey.startsWith('v_'));
    const pacings = payload.filter((p) => p.dataKey.startsWith('p_'));
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[220px]" style={{ borderColor: '#DCE0E6' }}>
        <p className="font-semibold mb-1" style={{ color: '#12101F' }}>
          {new Date(String(label) + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' })}
        </p>
        {actuals.map((p) => {
          const name = p.dataKey.slice(2);
          const pace = pacings.find((q) => q.dataKey === `p_${name}`);
          const diff = pace && pace.value > 0 ? (p.value - pace.value) / pace.value : null;
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 truncate" style={{ color: p.color, maxWidth: '160px' }}>
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="truncate" title={name}>{name}</span>
              </span>
              <span className="tabular-nums font-semibold whitespace-nowrap" style={{ color: '#12101F' }}>
                {fmt(p.value)}
                {diff !== null && (
                  <span className="ml-1.5 text-[10px] font-normal" style={{ color: diff >= 0 ? '#16A34A' : '#DC2626' }}>
                    {diff >= 0 ? '+' : ''}{Math.round(diff * 100)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
        {pacings.some((p) => p.value > 0) && (
          <p className="text-[10px] pt-1" style={{ color: '#8C9BAF', borderTop: '1px solid #F0F4F8' }}>
            % = afwijking t.o.v. verwacht dagtempo
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-5" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      {/* Controls */}
      <div className="flex flex-wrap items-start gap-4 mb-4">
        <div>
          <span className="gf-eyebrow block mb-1.5">Metric</span>
          <div className="flex gap-1.5">
            {(['spend', 'impressions'] as Metric[]).map((m) => {
              const active = metric === m;
              return (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className="text-xs font-semibold px-3 py-1.5 transition-all"
                  style={{
                    borderRadius: '4px',
                    background: active ? '#6331F4' : '#ffffff',
                    color:      active ? '#ffffff' : '#555E6C',
                    border:     `1px solid ${active ? '#6331F4' : '#DCE0E6'}`,
                  }}
                >
                  {m === 'spend' ? 'Spend' : 'Impressies'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="gf-eyebrow">Campagnes ({picked.size}/{campaigns.length})</span>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setPicked(new Set(campaigns.slice(0, 3).map((c) => c.name)))}
                className="font-semibold transition-colors"
                style={{ color: '#6331F4' }}
              >
                Top 3
              </button>
              <span style={{ color: '#DCE0E6' }}>·</span>
              <button
                onClick={() => setPicked(new Set(campaigns.map((c) => c.name)))}
                className="font-semibold transition-colors"
                style={{ color: '#6331F4' }}
              >
                Alle
              </button>
              <span style={{ color: '#DCE0E6' }}>·</span>
              <button
                onClick={() => setPicked(new Set())}
                className="font-semibold transition-colors"
                style={{ color: '#8C9BAF' }}
              >
                Wissen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {campaigns.map((c) => {
              const active = picked.has(c.name);
              const color  = active ? colorFor(c.name) : undefined;
              return (
                <button
                  key={c.name}
                  onClick={() => setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(c.name)) next.delete(c.name); else next.add(c.name);
                    return next;
                  })}
                  className="text-xs px-2 py-1 transition-all truncate max-w-[220px]"
                  title={c.name}
                  style={{
                    borderRadius: '4px',
                    background: active ? color : '#ffffff',
                    color:      active ? '#ffffff' : '#555E6C',
                    border:     `1px solid ${active ? color : '#DCE0E6'}`,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                    style={{ background: active ? '#ffffff' : PLATFORM_COLOR[c.platform] }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {picked.size === 0 || data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm" style={{ color: '#8C9BAF' }}>
          {picked.size === 0 ? 'Selecteer minimaal één campagne' : 'Geen data in deze periode'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d) => String(d).slice(5)}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmt(v)}
              width={72}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value: string) => {
                // Hide pacing lines from the legend to reduce noise.
                if (value.startsWith('⏵ ')) return value.slice(2);
                return value;
              }}
            />

            {[...picked].map((name) => {
              const c = colorFor(name);
              return (
                <Line
                  key={`v_${name}`}
                  type="monotone"
                  dataKey={`v_${name}`}
                  name={name}
                  stroke={c}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              );
            })}
            {[...picked].map((name) => {
              const c = colorFor(name);
              return (
                <Line
                  key={`p_${name}`}
                  type="monotone"
                  dataKey={`p_${name}`}
                  name={`⏵ ${name} (tempo)`}
                  stroke={c}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs mt-3" style={{ color: '#8C9BAF' }}>
        Onderbroken lijn = verwacht dagtempo per campagne ({metricLabel.toLowerCase()} totaal ÷ looptijd).
        Boven de lijn = sneller dan gepland, onder de lijn = achterstand.
      </p>
    </div>
  );
}
