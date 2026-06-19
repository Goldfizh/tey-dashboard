'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CampaignRow } from '@/types/campaign';
import type { Objective } from '@/types/objective';

interface Props {
  rows:      CampaignRow[];
  objective?: Objective;
}

// ── config ────────────────────────────────────────────────────────────────────

const PLATFORM_CFG = {
  LinkedIn:    { color: '#0077B5' },
  Meta:        { color: '#1877F2' },
  'Google Ads':{ color: '#F59E0B' },
} as const;
type PlatformKey = keyof typeof PLATFORM_CFG;

const fmtEur = (v: number) =>
  v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function getObjectiveConfig(objective: Objective | undefined) {
  switch (objective) {
    case 'video':
      return {
        title:      'CPCV trend (kosten per video view)',
        yFormat:    fmtEur,
        ttFormat:   fmtEur,
        compute:    (spend: number, _conv: number, impressions: number, thruplays: number) =>
                      thruplays > 0 ? spend / thruplays : null,
      };
    case 'impressies':
    case 'verkeer':
      return {
        title:      'CPM trend (kosten per 1000 impressies)',
        yFormat:    fmtEur,
        ttFormat:   fmtEur,
        compute:    (spend: number, _conv: number, impressions: number) =>
                      impressions > 0 ? spend / impressions * 1000 : null,
      };
    default: // conversies, leads, undefined
      return {
        title:      'CPA trend (kosten per sollicitant / lead)',
        yFormat:    fmtEur,
        ttFormat:   fmtEur,
        compute:    (spend: number, conv: number) =>
                      conv > 0 ? spend / conv : null,
      };
  }
}

// ── tooltip ───────────────────────────────────────────────────────────────────

function CustomTooltip({
  active, payload, label, ttFormat,
}: {
  active?:   boolean;
  payload?:  { name: string; value: number; color: string }[];
  label?:    string;
  ttFormat:  (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-gray-700 mb-2">{String(label)}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums">{ttFormat(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

export function CpaTrendChartSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-5" />
      <div className="h-56 bg-gray-100 rounded" />
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function CpaTrendChart({ rows, objective }: Props) {
  const cfg = getObjectiveConfig(objective);

  // Platform visibility toggles
  const [visible, setVisible] = useState<Record<PlatformKey, boolean>>({
    LinkedIn:     true,
    Meta:         true,
    'Google Ads': true,
  });

  function togglePlatform(key: PlatformKey) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  // Aggregate: date × platform → (spend, conv, impressions, thruplays)
  const byDate: Record<string, {
    li_spend: number; li_conv: number; li_imp: number; li_thru: number;
    me_spend: number; me_conv: number; me_imp: number; me_thru: number;
    go_spend: number; go_conv: number; go_imp: number; go_thru: number;
  }> = {};

  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = {
      li_spend: 0, li_conv: 0, li_imp: 0, li_thru: 0,
      me_spend: 0, me_conv: 0, me_imp: 0, me_thru: 0,
      go_spend: 0, go_conv: 0, go_imp: 0, go_thru: 0,
    };
    const d = byDate[r.date];
    if (r.platform === 'linkedin') {
      d.li_spend += r.spend; d.li_conv += r.conversions;
      d.li_imp   += r.impressions; d.li_thru += r.thruplays ?? 0;
    } else if (r.platform === 'meta') {
      d.me_spend += r.spend; d.me_conv += r.conversions;
      d.me_imp   += r.impressions; d.me_thru += r.thruplays ?? 0;
    } else {
      d.go_spend += r.spend; d.go_conv += r.conversions;
      d.go_imp   += r.impressions; d.go_thru += r.thruplays ?? 0;
    }
  }

  const data = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      LinkedIn:     cfg.compute(v.li_spend, v.li_conv, v.li_imp, v.li_thru),
      Meta:         cfg.compute(v.me_spend, v.me_conv, v.me_imp, v.me_thru),
      'Google Ads': cfg.compute(v.go_spend, v.go_conv, v.go_imp, v.go_thru),
    }));

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
        Geen trenddata beschikbaar voor de geselecteerde periode
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* Header row: title + platform toggles */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {cfg.title}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(Object.keys(PLATFORM_CFG) as PlatformKey[]).map((key) => {
            const on = visible[key];
            return (
              <button
                key={key}
                onClick={() => togglePlatform(key)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded transition-all"
                style={{
                  border:     `1.5px solid ${on ? PLATFORM_CFG[key].color : '#DCE0E6'}`,
                  background: on ? `${PLATFORM_CFG[key].color}18` : '#F8FAFC',
                  color:      on ? PLATFORM_CFG[key].color : '#BCC4CF',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: on ? PLATFORM_CFG[key].color : '#DCE0E6' }}
                />
                {key}
              </button>
            );
          })}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(d) => String(d).slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={cfg.yFormat}
            width={72}
          />
          <Tooltip content={<CustomTooltip ttFormat={cfg.ttFormat} />} />
          {(Object.keys(PLATFORM_CFG) as PlatformKey[]).map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={PLATFORM_CFG[key].color}
              strokeWidth={visible[key] ? 2 : 0}
              dot={false}
              activeDot={visible[key] ? { r: 4 } : false}
              connectNulls={false}
              hide={!visible[key]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
