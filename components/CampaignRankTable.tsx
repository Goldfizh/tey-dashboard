'use client';

import { useState, useMemo } from 'react';
import type { CampaignRow, Platform } from '@/types/campaign';
import type { Objective } from '@/types/objective';

// ── types ─────────────────────────────────────────────────────────────────────

type SortKey =
  | 'spend' | 'impressions' | 'clicks' | 'thruplays'
  | 'applicants' | 'cpa' | 'cpcv' | 'cpm' | 'cpc' | 'ctr' | 'vtr';
type SortDir = 'asc' | 'desc';

interface CampaignSummary {
  key:          string;
  platform:     Platform;
  campaign_name: string;
  spend:        number;
  applicants:   number;
  clicks:       number;
  impressions:  number;
  thruplays:    number;
  cpa:          number; // Infinity if no conversions
  cpcv:         number; // Infinity if no thruplays
  cpm:          number; // 0 if no impressions
  cpc:          number; // Infinity if no clicks
  ctr:          number;
  vtr:          number;
  budgetShare:  number;
}

interface Props {
  rows:       CampaignRow[];
  objective?: Objective;
}

// ── static config ─────────────────────────────────────────────────────────────

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5',
  meta:     '#1877F2',
  google:   '#F59E0B',
};
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  meta:     'Meta',
  google:   'Google',
};

// ── formatters ────────────────────────────────────────────────────────────────

const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtEur0 = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString('nl-NL');
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

// ── skeleton ──────────────────────────────────────────────────────────────────

export function CampaignRankTableSkeleton() {
  return (
    <div
      className="bg-white overflow-hidden animate-pulse"
      style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <div className="h-2.5 bg-gray-200 rounded w-1/4" />
      </div>
      <div className="divide-y" style={{ borderColor: '#F0F4F8' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex gap-4 items-center">
            <div className="h-4 bg-gray-200 rounded flex-1" />
            <div className="h-4 bg-gray-100 rounded w-20" />
            <div className="h-4 bg-gray-100 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── sort header ───────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, active, dir, onClick, align = 'right', className = '',
}: {
  label:     string;
  sortKey:   SortKey;
  active:    boolean;
  dir:       SortDir;
  onClick:   (k: SortKey) => void;
  align?:    'left' | 'right';
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      style={{ color: active ? '#1E3A8A' : '#8C9BAF' }}
      onClick={() => onClick(sortKey)}
    >
      {label}
      <span className="ml-1 text-[10px]">
        {active ? (dir === 'desc' ? '↓' : '↑') : '↕'}
      </span>
    </th>
  );
}

// ── expand / day breakdown ────────────────────────────────────────────────────

function DayRow({ r, objective }: { r: CampaignRow; objective: Objective }) {
  const cpa  = r.conversions > 0 ? r.spend / r.conversions   : null;
  const cpcv = (r.thruplays ?? 0) > 0 ? r.spend / (r.thruplays ?? 0) : null;
  const cpm  = r.impressions > 0 ? r.spend / r.impressions * 1000 : null;
  const cpc  = r.clicks > 0 ? r.spend / r.clicks : null;
  const ctr  = r.impressions > 0 ? r.clicks / r.impressions : 0;
  const vtr  = r.impressions > 0 ? (r.thruplays ?? 0) / r.impressions : 0;

  const heroValue =
    objective === 'video'                                    ? (cpcv !== null ? fmtEur(cpcv) : '—')
    : objective === 'impressies' || objective === 'verkeer'  ? (cpm  !== null ? fmtEur(cpm)  : '—')
    :                                                         (cpa  !== null ? fmtEur(cpa)  : '—');

  return (
    <tr className="transition-colors hover:bg-blue-50/30" style={{ borderBottom: '1px solid #F8FAFC' }}>
      {/* Date */}
      <td className="pl-12 pr-4 py-2 text-xs tabular-nums whitespace-nowrap" style={{ color: '#8C9BAF' }}>
        {new Date(r.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
      </td>
      {/* Spend */}
      <td className="px-4 py-2 text-xs tabular-nums text-right whitespace-nowrap" style={{ color: '#555E6C' }}>
        {fmtEur(r.spend)}
      </td>
      {/* Impressies */}
      <td className="px-4 py-2 text-xs tabular-nums text-right" style={{ color: '#555E6C' }}>
        {fmtNum(r.impressions)}
      </td>
      {/* Clicks / views */}
      {objective === 'video' ? (
        <>
          <td className="px-4 py-2 text-xs tabular-nums text-right" style={{ color: '#555E6C' }}>
            {(r.thruplays ?? 0) > 0 ? fmtNum(r.thruplays ?? 0) : '—'}
          </td>
          <td className="px-4 py-2 text-xs tabular-nums text-right" style={{ color: '#555E6C' }}>
            {vtr > 0 ? fmtPct(vtr) : '—'}
          </td>
        </>
      ) : (
        <>
          <td className="px-4 py-2 text-xs tabular-nums text-right" style={{ color: '#555E6C' }}>
            {fmtNum(r.clicks)}
          </td>
          <td className="px-4 py-2 text-xs tabular-nums text-right" style={{ color: '#555E6C' }}>
            {fmtPct(ctr)}
          </td>
        </>
      )}
      {/* Hero metric */}
      <td className="px-4 py-2 text-xs tabular-nums text-right font-semibold whitespace-nowrap" style={{ color: '#0B1020' }}>
        {heroValue}
      </td>
      {/* Empty budget-share col */}
      <td />
    </tr>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CampaignRankTable({ rows, objective = 'conversies' }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      // "lower is better" metrics default ascending; everything else descending
      const lowerBetter: SortKey[] = ['cpa', 'cpcv', 'cpm', 'cpc'];
      setSortDir(lowerBetter.includes(key) ? 'asc' : 'desc');
    }
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Aggregate rows by platform + campaign
  const campaigns = useMemo<CampaignSummary[]>(() => {
    const map = new Map<string, {
      platform: Platform; spend: number; applicants: number; clicks: number;
      impressions: number; thruplays: number;
    }>();
    for (const r of rows) {
      const key = `${r.platform}::${r.campaign_name}`;
      const cur = map.get(key) ?? { platform: r.platform, spend: 0, applicants: 0, clicks: 0, impressions: 0, thruplays: 0 };
      cur.spend       += r.spend;
      cur.applicants  += r.conversions;
      cur.clicks      += r.clicks;
      cur.impressions += r.impressions;
      cur.thruplays   += r.thruplays ?? 0;
      map.set(key, cur);
    }

    const totalSpend = Array.from(map.values()).reduce((s, v) => s + v.spend, 0);

    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      platform:      v.platform,
      campaign_name: key.split('::').slice(1).join('::'),
      spend:         v.spend,
      applicants:    v.applicants,
      clicks:        v.clicks,
      impressions:   v.impressions,
      thruplays:     v.thruplays,
      cpa:   v.applicants  > 0 ? v.spend / v.applicants  : Infinity,
      cpcv:  v.thruplays   > 0 ? v.spend / v.thruplays   : Infinity,
      cpm:   v.impressions > 0 ? v.spend / v.impressions * 1000 : 0,
      cpc:   v.clicks      > 0 ? v.spend / v.clicks      : Infinity,
      ctr:   v.impressions > 0 ? v.clicks / v.impressions : 0,
      vtr:   v.impressions > 0 ? v.thruplays / v.impressions : 0,
      budgetShare: totalSpend > 0 ? v.spend / totalSpend : 0,
    }));
  }, [rows]);

  // Sort
  const sorted = useMemo(() => {
    const inf = Infinity;
    return [...campaigns].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Push Infinity to bottom regardless of direction
      if (av === inf && bv === inf) return 0;
      if (av === inf) return 1;
      if (bv === inf) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [campaigns, sortKey, sortDir]);

  // Day rows per campaign (for expand)
  const dayRowsMap = useMemo(() => {
    const map = new Map<string, CampaignRow[]>();
    for (const r of rows) {
      const key = `${r.platform}::${r.campaign_name}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    // Sort each list by date asc
    map.forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [rows]);

  if (campaigns.length === 0) {
    return (
      <div
        className="bg-white p-8 text-center text-sm"
        style={{ border: '1px solid #DCE0E6', borderRadius: '8px', color: '#8C9BAF' }}
      >
        Geen campagnedata beschikbaar
      </div>
    );
  }

  // Column definitions per objective
  const isVideo   = objective === 'video';
  const isReach   = objective === 'impressies' || objective === 'verkeer';
  const isLeads   = objective === 'leads';
  // Default = conversies

  const heroSortKey: SortKey = isVideo ? 'cpcv' : isReach ? 'cpm' : 'cpa';
  const heroLabel = isVideo ? 'CPCV' : isReach ? 'CPM' : isLeads ? 'CPL' : 'CPA';

  const convLabel = isLeads ? 'Leads' : 'Sollicitanten';

  return (
    <div
      className="bg-white overflow-hidden"
      style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}
    >
      {/* Table header with sort info */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <span className="gf-eyebrow">{sorted.length} campagnes</span>
        <span className="text-xs" style={{ color: '#BCC4CF' }}>·</span>
        <span className="text-xs" style={{ color: '#8C9BAF' }}>
          Gesorteerd op{' '}
          <span className="font-semibold" style={{ color: '#1E3A8A' }}>
            {sortKey === 'spend' ? 'budget' : sortKey.toUpperCase()}
          </span>
          {' '}{sortDir === 'desc' ? '(hoog → laag)' : '(laag → hoog)'}
        </span>
        <span className="text-xs ml-auto" style={{ color: '#BCC4CF' }}>
          Klik ▸ om dagelijkse data te zien · klik kolomkop om te sorteren
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: '#F0F4F8' }}>
            <tr>
              {/* Expand */}
              <th className="px-4 py-3 w-8" />

              {/* Campaign name */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>
                Campagne
              </th>

              {/* Platform */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>
                Platform
              </th>

              {/* Budget */}
              <SortTh label="Budget"      sortKey="spend"      active={sortKey === 'spend'}      dir={sortDir} onClick={handleSort} />

              {/* Impressies — always */}
              <SortTh label="Impressies"  sortKey="impressions" active={sortKey === 'impressions'} dir={sortDir} onClick={handleSort} />

              {isVideo ? (
                <>
                  <SortTh label="Compl. views" sortKey="thruplays" active={sortKey === 'thruplays'} dir={sortDir} onClick={handleSort} />
                  <SortTh label="VTR"          sortKey="vtr"       active={sortKey === 'vtr'}       dir={sortDir} onClick={handleSort} />
                </>
              ) : (
                <>
                  <SortTh label="Clicks"  sortKey="clicks" active={sortKey === 'clicks'} dir={sortDir} onClick={handleSort} />
                  <SortTh label="CTR"     sortKey="ctr"    active={sortKey === 'ctr'}    dir={sortDir} onClick={handleSort} />
                </>
              )}

              {/* CPC — for non-video */}
              {!isVideo && (
                <SortTh label="CPC" sortKey="cpc" active={sortKey === 'cpc'} dir={sortDir} onClick={handleSort} />
              )}

              {/* Conversions — for conversies/leads */}
              {!isVideo && !isReach && (
                <SortTh label={convLabel} sortKey="applicants" active={sortKey === 'applicants'} dir={sortDir} onClick={handleSort} />
              )}

              {/* Hero metric */}
              <SortTh
                label={heroLabel}
                sortKey={heroSortKey}
                active={sortKey === heroSortKey}
                dir={sortDir}
                onClick={handleSort}
                className="font-extrabold"
              />

              {/* Budget share */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-36 whitespace-nowrap" style={{ color: '#8C9BAF' }}>
                Aandeel
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, idx) => {
              const color     = PLATFORM_COLOR[c.platform];
              const isExp     = expanded.has(c.key);
              const dayRows   = dayRowsMap.get(c.key) ?? [];
              const isHeroTop = idx === 0 && c[heroSortKey] !== Infinity && c[heroSortKey] > 0;

              const heroVal =
                heroSortKey === 'cpcv' ? (c.cpcv !== Infinity ? fmtEur(c.cpcv) : '—')
                : heroSortKey === 'cpm'  ? (c.cpm  > 0         ? fmtEur(c.cpm)  : '—')
                :                         (c.cpa  !== Infinity ? fmtEur(c.cpa)  : '—');

              return [
                /* ── Campaign row ── */
                <tr
                  key={c.key}
                  className="transition-colors"
                  style={{
                    borderBottom: isExp ? 'none' : '1px solid #F0F4F8',
                    background: isHeroTop && sortKey === heroSortKey ? 'rgba(22,163,74,0.03)' : undefined,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isHeroTop && sortKey === heroSortKey ? 'rgba(22,163,74,0.03)' : '')}
                >
                  {/* Expand toggle */}
                  <td className="px-4 py-3 w-8">
                    <button
                      onClick={() => toggleExpand(c.key)}
                      title={isExp ? 'Inklappen' : 'Dagelijkse uitwerking bekijken'}
                      className="flex items-center justify-center w-5 h-5 rounded transition-all"
                      style={{
                        background: isExp ? '#1E3A8A14' : '#F0F4F8',
                        color: isExp ? '#1E3A8A' : '#8C9BAF',
                        border: `1px solid ${isExp ? '#1E3A8A' : '#DCE0E6'}`,
                        fontSize: '10px',
                      }}
                    >
                      {isExp ? '▾' : '▸'}
                    </button>
                  </td>

                  {/* Campaign name — wrap instead of truncate */}
                  <td className="px-4 py-3 font-medium" style={{ color: '#0B1020', maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.35' }}>
                    {c.campaign_name}
                  </td>

                  {/* Platform badge */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 text-xs font-bold whitespace-nowrap"
                      style={{ background: color, borderRadius: '4px', color: c.platform === 'google' ? '#0B1020' : '#ffffff' }}
                    >
                      {PLATFORM_LABEL[c.platform]}
                    </span>
                  </td>

                  {/* Budget */}
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold" style={{ color: '#555E6C' }}>
                    {fmtEur0(c.spend)}
                  </td>

                  {/* Impressies */}
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#555E6C' }}>
                    {fmtNum(c.impressions)}
                  </td>

                  {isVideo ? (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#555E6C' }}>
                        {c.thruplays > 0 ? fmtNum(c.thruplays) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#555E6C' }}>
                        {c.vtr > 0 ? fmtPct(c.vtr) : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#555E6C' }}>
                        {fmtNum(c.clicks)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#555E6C' }}>
                        {fmtPct(c.ctr)}
                      </td>
                    </>
                  )}

                  {!isVideo && (
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: '#555E6C' }}>
                      {c.cpc !== Infinity ? fmtEur(c.cpc) : '—'}
                    </td>
                  )}

                  {!isVideo && !isReach && (
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#555E6C' }}>
                      {fmtNum(c.applicants)}
                    </td>
                  )}

                  {/* Hero metric */}
                  <td
                    className="px-4 py-3 text-right tabular-nums font-bold whitespace-nowrap"
                    style={{ color: isHeroTop && sortKey === heroSortKey ? '#16A34A' : '#0B1020' }}
                  >
                    {isHeroTop && sortKey === heroSortKey && (
                      <span className="mr-1 text-xs">✓</span>
                    )}
                    {heroVal}
                  </td>

                  {/* Budget share */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F4F8', minWidth: '48px' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(c.budgetShare * 100).toFixed(1)}%`, background: color }}
                        />
                      </div>
                      <span className="text-xs w-8 text-right tabular-nums" style={{ color: '#8C9BAF' }}>
                        {(c.budgetShare * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>,

                /* ── Expanded day breakdown ── */
                isExp && (
                  <tr key={`${c.key}--expand`} style={{ borderBottom: '1px solid #F0F4F8' }}>
                    <td colSpan={99} style={{ padding: 0, background: '#FAFBFF' }}>
                      {/* Sub-header */}
                      <div
                        className="flex items-center gap-3 px-5 py-2.5"
                        style={{ borderBottom: '1px solid #EEF2F8', borderTop: '1px solid #E8EDFF' }}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#1E3A8A' }}>
                          📅 Dagelijkse uitsplitsing — {c.campaign_name}
                        </span>
                        <span className="text-xs ml-auto" style={{ color: '#BCC4CF' }}>
                          {dayRows.length} dag{dayRows.length !== 1 ? 'en' : ''} met data
                        </span>
                      </div>

                      {dayRows.length === 0 ? (
                        <p className="px-12 py-3 text-xs" style={{ color: '#8C9BAF' }}>
                          Geen dagdata beschikbaar
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: '#F4F6FF' }}>
                              <th className="pl-12 pr-4 py-2 text-left text-xs font-semibold tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Datum</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Spend</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider" style={{ color: '#8C9BAF' }}>Impressies</th>
                              {isVideo ? (
                                <>
                                  <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Compl. views</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider" style={{ color: '#8C9BAF' }}>VTR</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider" style={{ color: '#8C9BAF' }}>Clicks</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider" style={{ color: '#8C9BAF' }}>CTR</th>
                                </>
                              )}
                              <th className="px-4 py-2 text-right text-xs font-semibold tracking-wider whitespace-nowrap" style={{ color: '#1E3A8A' }}>
                                {heroLabel}
                              </th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {dayRows.map((r) => (
                              <DayRow key={r.date} r={r} objective={objective} />
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Ad set level note */}
                      <div
                        className="flex items-start gap-2 px-5 py-3 mx-4 my-3 rounded-lg"
                        style={{ background: '#F0F4F8', border: '1px solid #DCE0E6' }}
                      >
                        <span className="text-sm shrink-0 mt-0.5">💡</span>
                        <p className="text-xs" style={{ color: '#8C9BAF', lineHeight: '1.5' }}>
                          <strong style={{ color: '#555E6C' }}>Advertentieset- en advertentieniveau</strong> — om resultaten per advertentieset, advertentie en plaatsing te bekijken is een extra tabblad in de Google Sheet nodig (bijv.{' '}
                          <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: '#E8EDF4', color: '#1E3A8A' }}>linkedin_adsets</code>,{' '}
                          <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: '#E8EDF4', color: '#1E3A8A' }}>meta_adsets</code>
                          ) met de exports vanuit het advertentieplatform op dat niveau. Neem contact op met Goldfizh om dit toe te voegen.
                        </p>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
