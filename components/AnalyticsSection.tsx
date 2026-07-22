'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { AnalyticsDayRow, ConversionBySource, ConversionByCampaign } from '@/lib/analytics';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString('nl-NL');
const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

function sourceToChannel(source: string): 'linkedin' | 'meta' | 'google' | 'other' {
  const s = source.toLowerCase();
  if (s.includes('linkedin') || s.includes('lnkd'))                                   return 'linkedin';
  if (s.includes('facebook') || s.includes('instagram') || s.includes('fb') ||
      s.includes('meta')     || s === 'ig')                                            return 'meta';
  if (s.includes('google')   || s.includes('goog'))                                   return 'google';
  return 'other';
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  'Paid Social':    { label: 'Betaald social',  color: '#6366f1' },
  'Organic Social': { label: 'Organisch social', color: '#818cf8' },
  'Paid Search':    { label: 'Betaald zoeken',   color: '#f59e0b' },
  'Organic Search': { label: 'Organisch zoeken', color: '#10b981' },
  'Direct':         { label: 'Direct',           color: '#3b82f6' },
  'Referral':       { label: 'Referral',         color: '#3B82F6' },
  'Email':          { label: 'E-mail',           color: '#ec4899' },
  'Unassigned':     { label: 'Overig',           color: '#d1d5db' },
};
function channelLabel(ch: string) { return CHANNEL_CONFIG[ch]?.label ?? ch; }

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="h-2.5 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-2 bg-gray-100 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="h-3 bg-gray-200 rounded w-1/4 mb-5" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ── Real CPA card ─────────────────────────────────────────────────────────────

function RealCpaCard({
  label, color, completions, spend,
}: {
  label: string; color: string; completions: number; spend: number;
}) {
  const cpa = completions > 0 && spend > 0 ? spend / completions : null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>
        {label}
      </p>
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Echte CPA (GA4)</p>
        <p className="text-3xl font-bold text-gray-900 tabular-nums">
          {cpa !== null ? fmtEur(cpa) : '—'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Spend ÷ voltooide sollicitaties</p>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Sollicitaties (GA4)</p>
          <p className="text-sm font-semibold text-gray-800">{fmtNum(completions)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Budget</p>
          <p className="text-sm font-semibold text-gray-800">{spend > 0 ? fmtEur(spend) : '—'}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  dateFrom?: string;
  dateTo?:   string;
  liSpend?:  number;
  meSpend?:  number;
}

interface AnalyticsData {
  byDay:                 AnalyticsDayRow[];
  conversionsBySource:   ConversionBySource[];
  conversionsByCampaign: ConversionByCampaign[];
}

export default function AnalyticsSection({ dateFrom, dateTo, liSpend = 0, meSpend = 0 }: Props) {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (dateFrom) params.set('startDate', dateFrom);
    if (dateTo)   params.set('endDate',   dateTo);

    fetch(`/api/analytics?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<AnalyticsData>;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  // ── Aggregations ─────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    if (!data) return { sessions: 0, users: 0, keyEvents: 0 };
    return data.byDay.reduce(
      (acc, r) => ({ sessions: acc.sessions + r.sessions, users: acc.users + r.users, keyEvents: acc.keyEvents + r.keyEvents }),
      { sessions: 0, users: 0, keyEvents: 0 },
    );
  }, [data]);

  const byDay = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { sessions: number; keyEvents: number }>();
    for (const r of data.byDay) {
      const cur = map.get(r.date) ?? { sessions: 0, keyEvents: 0 };
      cur.sessions  += r.sessions;
      cur.keyEvents += r.keyEvents;
      map.set(r.date, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [data]);

  const completionsByPlatform = useMemo(() => {
    if (!data) return { linkedin: 0, meta: 0, google: 0, other: 0 };
    return data.conversionsByCampaign.reduce(
      (acc, r) => {
        const ch = sourceToChannel(r.source);
        return { ...acc, [ch]: acc[ch as keyof typeof acc] + r.completions };
      },
      { linkedin: 0, meta: 0, google: 0, other: 0 },
    );
  }, [data]);

  const campaignRows = useMemo(() => {
    if (!data) return [];
    return data.conversionsByCampaign.slice(0, 15);
  }, [data]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <SectionSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <strong>Google Analytics:</strong> {error}
      </div>
    );
  }

  const totalCompletions = completionsByPlatform.linkedin + completionsByPlatform.meta +
                           completionsByPlatform.google  + completionsByPlatform.other;
  const convRate = totals.sessions > 0
    ? (totalCompletions / totals.sessions * 100).toFixed(2)
    : '—';

  return (
    <div className="space-y-6">

      {/* ── Real CPA section ── */}
      <div>
        <p className="text-xs text-[#8C9BAF] mb-3">
          Sollicitaties geteld via <strong className="text-[#555E6C]">Sollicitatie_voltooid_recruitee</strong> in GA4,
          gekoppeld aan kanaal via UTM-source. Spend uit de Advertenties-tab.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RealCpaCard label="LinkedIn"        color="#0077B5" completions={completionsByPlatform.linkedin} spend={liSpend} />
          <RealCpaCard label="Meta / Facebook" color="#1877F2" completions={completionsByPlatform.meta}     spend={meSpend} />
        </div>
      </div>

      {/* ── Sessions KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Sessies</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmtNum(totals.sessions)}</p>
          <p className="text-xs text-gray-400 mt-1">Websitebezoekers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Voltooide sollicitaties</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmtNum(totalCompletions)}</p>
          <p className="text-xs text-gray-400 mt-1">Via Recruitee (GA4)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Conversieratio</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{convRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Sessies → sollicitatie</p>
        </div>
      </div>

      {/* ── Sessions trend ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Sessies per dag</p>
        {byDay.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Geen data</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={byDay} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v: unknown) => [fmtNum(Number(v)), '']} labelFormatter={(l) => String(l)} />
              <Line type="monotone" dataKey="sessions"  name="Sessies"    stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="keyEvents" name="Key events" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Completions by UTM campaign ── */}
      {campaignRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Voltooide sollicitaties per campagne (GA4 · UTM)
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Campagne (UTM)</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Bron</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Sollicitaties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaignRows.map((r, i) => {
                const ch = sourceToChannel(r.source);
                const color =
                  ch === 'linkedin' ? '#0077B5' :
                  ch === 'meta'     ? '#1877F2' :
                  ch === 'google'   ? '#F59E0B' : '#9ca3af';
                const isUnset = r.campaign === '(not set)';
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium max-w-xs truncate" title={r.campaign}
                        style={{ color: isUnset ? '#8C9BAF' : '#0B1020' }}>
                      {isUnset ? '— geen UTM-campagne —' : r.campaign}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold px-2 py-0.5" style={{ background: color, borderRadius: '4px', color: ch === 'google' ? '#0B1020' : '#ffffff' }}>
                        {r.source}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums" style={{ color: '#0B1020' }}>
                      {fmtNum(r.completions)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Channel breakdown ── */}
      {data && data.byDay.length > 0 && (() => {
        const map = new Map<string, number>();
        for (const r of data.byDay) map.set(r.channel, (map.get(r.channel) ?? 0) + r.sessions);
        const rows  = Array.from(map.entries()).sort(([, a], [, b]) => b - a);
        const total = rows.reduce((s, [, v]) => s + v, 0);
        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Sessies per kanaal</p>
            <div className="space-y-2.5">
              {rows.map(([ch, count]) => {
                const pct   = total > 0 ? (count / total) * 100 : 0;
                const color = CHANNEL_CONFIG[ch]?.color ?? '#9ca3af';
                return (
                  <div key={ch} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-36 shrink-0">{channelLabel(ch)}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${pct.toFixed(1)}%`, background: color }} />
                    </div>
                    <span className="text-xs tabular-nums text-gray-600 w-12 text-right">{fmtNum(count)}</span>
                    <span className="text-xs tabular-nums text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
