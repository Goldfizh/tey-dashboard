'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import KpiCard, { KpiCardSkeleton } from '@/components/KpiCard';
import ChannelCard, { ChannelCardSkeleton } from '@/components/ChannelCard';
import CampaignRankTable, { CampaignRankTableSkeleton } from '@/components/CampaignRankTable';
import CpaTrendChart, { CpaTrendChartSkeleton } from '@/components/CpaTrendChart';
import AnalyticsSection from '@/components/AnalyticsSection';
import SollicitatiesSection from '@/components/SollicitatiesSection';
import GoogleAdsWrapper from '@/components/GoogleAdsWrapper';
import PlatformCampaignDropdown from '@/components/PlatformCampaignDropdown';
import type { CampaignRow, Platform } from '@/types/campaign';
import { sumRows } from '@/types/campaign';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString('nl-NL');
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

// ── Date helpers ──────────────────────────────────────────────────────────────
type Preset = 'week' | 'month' | '3months' | 'custom';
type Tab    = 'ads' | 'ga4' | 'sollicitaties';

function fmt(d: Date) { return d.toISOString().split('T')[0]; }

function presetRange(preset: Preset, customFrom: string, customTo: string) {
  if (preset === 'custom') return { from: customFrom, to: customTo };
  const today = new Date();
  const to    = fmt(today);
  if (preset === 'week') {
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    const mon  = new Date(today);
    mon.setDate(today.getDate() - diff);
    return { from: fmt(mon), to };
  }
  if (preset === 'month') {
    return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  // 3months
  const start = new Date(today);
  start.setMonth(today.getMonth() - 3);
  return { from: fmt(start), to };
}

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5',
  meta:     '#1877F2',
  google:   '#F59E0B',
};
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  meta:     'Meta',
  google:   'Google Ads',
};

// ── Spotlight card ────────────────────────────────────────────────────────────
interface SpotlightCardProps {
  badge: string;
  badgeColor: string;
  title: string;
  campaignName: string;
  platform: Platform;
  metric: string;
  metricLabel: string;
}
function SpotlightCard({ badge, badgeColor, title, campaignName, platform, metric, metricLabel }: SpotlightCardProps) {
  return (
    <div className="bg-white p-5" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{badge}</span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: badgeColor }}>{title}</span>
      </div>
      <p className="text-base font-semibold leading-snug mb-3 truncate" title={campaignName} style={{ color: '#12101F' }}>
        {campaignName}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold px-2 py-0.5 text-white" style={{ background: PLATFORM_COLOR[platform], borderRadius: '4px' }}>
          {PLATFORM_LABEL[platform]}
        </span>
        <span className="text-xs" style={{ color: '#8C9BAF' }}>
          {metricLabel}: <span className="font-bold" style={{ color: '#12101F' }}>{metric}</span>
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [rows,    setRows]    = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Navigation
  const [tab,         setTab]         = useState<Tab>('ads');
  const [preset,      setPreset]      = useState<Preset>('3months');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  // Campaign selector
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  const { from: dateFrom, to: dateTo } = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsRes, googleRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/google-ads'),
      ]);
      if (!campaignsRes.ok) {
        const json = await campaignsRes.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${campaignsRes.status}`);
      }
      const campaigns: CampaignRow[] = await campaignsRes.json();
      const google: CampaignRow[]    = googleRes.ok ? await googleRes.json() : [];
      setRows([...campaigns, ...google]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Initialise (or re-initialise after refresh) the campaign selection to all campaigns
  useEffect(() => {
    setSelectedCampaigns(new Set(rows.map((r) => r.campaign_name)));
  }, [rows]);

  // Filtered rows by date
  const filtered = useMemo(() =>
    rows.filter((r) =>
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo   || r.date <= dateTo)
    ),
    [rows, dateFrom, dateTo],
  );

  // Filtered rows by date AND selected campaigns
  const filteredRows = useMemo(() =>
    selectedCampaigns.size === 0
      ? filtered
      : filtered.filter((r) => selectedCampaigns.has(r.campaign_name)),
    [filtered, selectedCampaigns],
  );

  // Totals
  const totals     = useMemo(() => sumRows(filteredRows), [filteredRows]);
  const overallCpa = totals.conversions > 0 ? totals.spend / totals.conversions : null;

  // Per-channel totals
  const liTotals = useMemo(() => sumRows(filteredRows.filter((r) => r.platform === 'linkedin')), [filteredRows]);
  const meTotals = useMemo(() => sumRows(filteredRows.filter((r) => r.platform === 'meta')),     [filteredRows]);
  const goTotals = useMemo(() => sumRows(filteredRows.filter((r) => r.platform === 'google')),   [filteredRows]);
  const liCpa = liTotals.conversions > 0 ? liTotals.spend / liTotals.conversions : null;
  const meCpa = meTotals.conversions > 0 ? meTotals.spend / meTotals.conversions : null;
  const goCpa = goTotals.conversions > 0 ? goTotals.spend / goTotals.conversions : null;
  const liCtr = liTotals.impressions > 0 ? liTotals.clicks / liTotals.impressions : 0;
  const meCtr = meTotals.impressions > 0 ? meTotals.clicks / meTotals.impressions : 0;
  const goCtr = goTotals.impressions > 0 ? goTotals.clicks / goTotals.impressions : 0;
  const liCpc = liTotals.clicks > 0 ? liTotals.spend / liTotals.clicks : 0;
  const meCpc = meTotals.clicks > 0 ? meTotals.spend / meTotals.clicks : 0;
  const goCpc = goTotals.clicks > 0 ? goTotals.spend / goTotals.clicks : 0;
  const liCpv = (liTotals.thruplays ?? 0) > 0 ? liTotals.spend / (liTotals.thruplays ?? 0) : null;
  const meCpv = (meTotals.thruplays ?? 0) > 0 ? meTotals.spend / (meTotals.thruplays ?? 0) : null;
  const goCpv = (goTotals.thruplays ?? 0) > 0 ? goTotals.spend / (goTotals.thruplays ?? 0) : null;
  const hasVideoData = (liTotals.thruplays ?? 0) + (meTotals.thruplays ?? 0) + (goTotals.thruplays ?? 0) > 0;

  const cpas       = [liCpa, meCpa, goCpa];
  const minCpa     = Math.min(...cpas.filter((c): c is number => c !== null));
  const liWins     = liCpa !== null && liCpa === minCpa;
  const meWins     = meCpa !== null && meCpa === minCpa && !liWins;
  const goWins     = goCpa !== null && goCpa === minCpa && !liWins && !meWins;
  const bestChannel = liWins ? 'LinkedIn' : meWins ? 'Meta' : goWins ? 'Google Ads' : '—';

  // Campaign summaries (spotlight)
  const campaignSummaries = useMemo(() => {
    const map = new Map<string, { platform: Platform; spend: number; applicants: number; clicks: number; impressions: number }>();
    for (const r of filteredRows) {
      const key = `${r.platform}::${r.campaign_name}`;
      const cur = map.get(key) ?? { platform: r.platform, spend: 0, applicants: 0, clicks: 0, impressions: 0 };
      cur.spend       += r.spend;
      cur.applicants  += r.conversions;
      cur.clicks      += r.clicks;
      cur.impressions += r.impressions;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      campaign_name: key.split('::')[1],
      platform:      v.platform,
      spend:         v.spend,
      applicants:    v.applicants,
      clicks:        v.clicks,
      cpa:           v.applicants > 0 ? v.spend / v.applicants : Infinity,
      cpc:           v.clicks     > 0 ? v.spend / v.clicks     : Infinity,
    }));
  }, [filtered]);

  const bestCpaCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.applicants > 0).sort((a, b) => a.cpa - b.cpa)[0] ?? null,
    [campaignSummaries],
  );
  const bestCpcCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.clicks > 0).sort((a, b) => a.cpc - b.cpc)[0] ?? null,
    [campaignSummaries],
  );

  // Per-platform campaign lists for the control-bar dropdowns
  const liCampaigns = useMemo(() =>
    [...new Set(rows.filter((r) => r.platform === 'linkedin').map((r) => r.campaign_name))].sort(),
    [rows],
  );
  const meCampaigns = useMemo(() =>
    [...new Set(rows.filter((r) => r.platform === 'meta').map((r) => r.campaign_name))].sort(),
    [rows],
  );
  const goCampaigns = useMemo(() =>
    [...new Set(rows.filter((r) => r.platform === 'google').map((r) => r.campaign_name))].sort(),
    [rows],
  );

  // ── Preset button helper ───────────────────────────────────────────────────
  const presets: { key: Preset; label: string }[] = [
    { key: 'week',    label: 'Deze week' },
    { key: 'month',   label: 'Deze maand' },
    { key: '3months', label: '3 maanden' },
    { key: 'custom',  label: 'Aangepast' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen" style={{ background: '#F0F4F8' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: '#12101F' }}>
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-sm flex-shrink-0" style={{ background: '#6331F4' }} aria-hidden="true" />
            <span className="text-sm font-bold text-white tracking-tight">Teylingereind</span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 font-semibold" style={{ background: 'rgba(99,49,244,0.25)', color: '#A38DFB', borderRadius: '4px' }}>
              Recruitment
            </span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-xs font-semibold disabled:opacity-40 transition-all rounded-lg px-4 py-2"
            style={{ background: 'var(--gf-purple-600)', color: '#ffffff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gf-purple-700)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--gf-purple-600)')}
          >
            {loading ? 'Laden…' : '↺ Vernieuwen'}
          </button>
        </div>
      </header>

      {/* ── Control bar ─────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-white" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <div className="max-w-[1280px] mx-auto px-6">

          {/* Row 1: centered nav */}
          <nav className="flex items-center justify-center" style={{ borderBottom: '1px solid #F0F4F8' }}>
            {([
              { key: 'ads' as Tab,           label: 'Advertenties' },
              { key: 'sollicitaties' as Tab, label: 'Sollicitaties' },
              { key: 'ga4' as Tab,           label: 'GA4 — Website' },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative px-6 py-4 text-sm font-semibold transition-colors"
                  style={{ color: active ? '#12101F' : '#8C9BAF', letterSpacing: '-0.01em' }}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-4 right-4"
                      style={{ height: '2px', background: '#6331F4', borderRadius: '2px 2px 0 0' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Row 2: period presets */}
          <div className="flex flex-wrap items-center gap-2 py-3">
            <span className="gf-eyebrow mr-1 hidden sm:inline-flex">Periode</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {presets.map(({ key, label }) => {
                const active = preset === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPreset(key)}
                    className="text-xs font-semibold px-3 py-1.5 transition-all"
                    style={{
                      borderRadius: '4px',
                      background: active ? '#6331F4' : '#ffffff',
                      color:      active ? '#ffffff' : '#555E6C',
                      border:     `1px solid ${active ? '#6331F4' : '#DCE0E6'}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}

              {preset === 'custom' && (
                <div className="flex items-center gap-1.5 ml-1">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6331F4]"
                    style={{ border: '1px solid #DCE0E6', borderRadius: '4px', color: '#12101F' }}
                  />
                  <span className="text-xs" style={{ color: '#8C9BAF' }}>t/m</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6331F4]"
                    style={{ border: '1px solid #DCE0E6', borderRadius: '4px', color: '#12101F' }}
                  />
                </div>
              )}
            </div>

            {preset !== 'custom' && dateFrom && (
              <span className="text-xs ml-2" style={{ color: '#BCC4CF' }}>
                {new Date(dateFrom).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                {' '}–{' '}
                {new Date(dateTo).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Row 3: per-platform campaign filters (Ads tab only) */}
          {tab === 'ads' && !loading && (liCampaigns.length > 0 || meCampaigns.length > 0 || goCampaigns.length > 0) && (
            <div className="flex items-center gap-2 pb-3">
              <span className="gf-eyebrow mr-1 hidden sm:inline-flex">Campagnes</span>
              <PlatformCampaignDropdown platform="linkedin" campaigns={liCampaigns} selected={selectedCampaigns} onChange={setSelectedCampaigns} />
              <PlatformCampaignDropdown platform="meta"     campaigns={meCampaigns} selected={selectedCampaigns} onChange={setSelectedCampaigns} />
              <PlatformCampaignDropdown platform="google"   campaigns={goCampaigns} selected={selectedCampaigns} onChange={setSelectedCampaigns} />
            </div>
          )}

        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-10">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg leading-none">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Fout bij laden</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
              <button onClick={fetchData} className="mt-2 text-xs font-semibold text-red-700 underline">
                Opnieuw proberen
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: ADVERTENTIES                                          */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'ads' && (
          <>
            <div className="space-y-10">

              {/* Top KPIs */}
              <section>
                <h2 className="gf-eyebrow mb-5">Totaaloverzicht</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
                  ) : (
                    <>
                      <KpiCard title="Budget gespendeerd"     value={fmtEur(totals.spend)}                          subtitle="Alle kanalen" />
                      <KpiCard title="Totaal sollicitanten"   value={fmtNum(totals.conversions)}                    subtitle="LinkedIn · Meta · Google Ads" />
                      <KpiCard title="Kosten per sollicitant" value={overallCpa !== null ? fmtEur(overallCpa) : '—'} subtitle="Spend ÷ sollicitanten" />
                      <KpiCard
                        title="Beste kanaal"
                        value={bestChannel}
                        accent={bestChannel !== '—'}
                        subtitle={
                          bestChannel !== '—' && isFinite(minCpa)
                            ? `Laagste CPA: ${fmtEur(minCpa)}`
                            : 'Geen conversiedata'
                        }
                      />
                    </>
                  )}
                </div>
              </section>

              {/* Channel comparison */}
              <section>
                <h2 className="gf-eyebrow mb-5">Kanaalvergelijking</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {loading ? (
                    <><ChannelCardSkeleton /><ChannelCardSkeleton /><ChannelCardSkeleton /></>
                  ) : (
                    <>
                      <ChannelCard platform="linkedin" spend={liTotals.spend} applicants={liTotals.conversions} clicks={liTotals.clicks} impressions={liTotals.impressions} thruplays={liTotals.thruplays ?? 0} isWinner={liWins} />
                      <ChannelCard platform="meta"     spend={meTotals.spend} applicants={meTotals.conversions} clicks={meTotals.clicks} impressions={meTotals.impressions} thruplays={meTotals.thruplays ?? 0} isWinner={meWins} />
                      <ChannelCard platform="google"   spend={goTotals.spend} applicants={goTotals.conversions} clicks={goTotals.clicks} impressions={goTotals.impressions} thruplays={goTotals.thruplays ?? 0} isWinner={goWins} />
                    </>
                  )}
                </div>

                {!loading && (
                  <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
                    <table className="w-full">
                      <thead style={{ background: '#F0F4F8', borderBottom: '1px solid #DCE0E6' }}>
                        <tr>
                          <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider w-36" style={{ color: '#8C9BAF' }}>Metric</th>
                          <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#0077B5' }}>LinkedIn</th>
                          <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#1877F2' }}>Meta</th>
                          <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>Google Ads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Budget',        li: fmtEur(liTotals.spend),        me: fmtEur(meTotals.spend),        go: fmtEur(goTotals.spend),        liR: liTotals.spend,        meR: meTotals.spend,        goR: goTotals.spend,        neutral: true },
                          { label: 'Impressies',    li: fmtNum(liTotals.impressions),  me: fmtNum(meTotals.impressions),  go: fmtNum(goTotals.impressions),  liR: liTotals.impressions,  meR: meTotals.impressions,  goR: goTotals.impressions },
                          { label: 'Clicks',        li: fmtNum(liTotals.clicks),       me: fmtNum(meTotals.clicks),       go: fmtNum(goTotals.clicks),       liR: liTotals.clicks,       meR: meTotals.clicks,       goR: goTotals.clicks },
                          { label: 'CTR',           li: fmtPct(liCtr),                 me: fmtPct(meCtr),                 go: fmtPct(goCtr),                 liR: liCtr,                 meR: meCtr,                 goR: goCtr },
                          { label: 'Kosten/klik',   li: liCpc > 0 ? fmtEur(liCpc) : '—', me: meCpc > 0 ? fmtEur(meCpc) : '—', go: goCpc > 0 ? fmtEur(goCpc) : '—', liR: liCpc, meR: meCpc, goR: goCpc, lower: true },
                          { label: 'Sollicitanten', li: fmtNum(liTotals.conversions),  me: fmtNum(meTotals.conversions),  go: fmtNum(goTotals.conversions),  liR: liTotals.conversions,  meR: meTotals.conversions,  goR: goTotals.conversions },
                          { label: 'Kosten/soll.',  li: liCpa != null ? fmtEur(liCpa) : '—', me: meCpa != null ? fmtEur(meCpa) : '—', go: goCpa != null ? fmtEur(goCpa) : '—', liR: liCpa ?? 0, meR: meCpa ?? 0, goR: goCpa ?? 0, lower: true },
                          ...(hasVideoData ? [
                            { label: 'Video views',    li: (liTotals.thruplays ?? 0) > 0 ? fmtNum(liTotals.thruplays ?? 0) : '—', me: (meTotals.thruplays ?? 0) > 0 ? fmtNum(meTotals.thruplays ?? 0) : '—', go: (goTotals.thruplays ?? 0) > 0 ? fmtNum(goTotals.thruplays ?? 0) : '—', liR: liTotals.thruplays ?? 0, meR: meTotals.thruplays ?? 0, goR: goTotals.thruplays ?? 0 },
                            { label: 'Kosten/video',   li: liCpv != null ? fmtEur(liCpv) : '—', me: meCpv != null ? fmtEur(meCpv) : '—', go: goCpv != null ? fmtEur(goCpv) : '—', liR: liCpv ?? 0, meR: meCpv ?? 0, goR: goCpv ?? 0, lower: true },
                          ] : []),
                        ].map(({ label, li, me, go, liR, meR, goR, lower, neutral }) => {
                          const best = lower
                            ? Math.min(...[liR, meR, goR].filter(Boolean))
                            : Math.max(liR, meR, goR);
                          const win = (v: number) => !neutral && v === best && v > 0;
                          return (
                            <tr key={label} style={{ borderBottom: '1px solid #F0F4F8' }} className="last:border-0">
                              <td className="py-3 px-4 text-xs font-medium" style={{ color: '#555E6C' }}>{label}</td>
                              {([li, me, go] as string[]).map((val, i) => {
                                const raw = [liR, meR, goR][i] as number;
                                return (
                                  <td key={i} className="py-3 px-4 text-sm tabular-nums font-semibold" style={{ color: win(raw) ? '#16A34A' : '#12101F' }}>
                                    {win(raw) && <span className="mr-1" style={{ color: '#16A34A' }}>✓</span>}
                                    {val}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* CPA trend */}
              <section>
                <h2 className="gf-eyebrow mb-5">CPA trend</h2>
                {loading ? <CpaTrendChartSkeleton /> : <CpaTrendChart rows={filteredRows} />}
              </section>

              {/* Uitschieters */}
              <section>
                <h2 className="gf-eyebrow mb-5">Uitschieters</h2>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <KpiCardSkeleton /><KpiCardSkeleton />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bestCpaCampaign ? (
                      <SpotlightCard badge="🏆" badgeColor="#16A34A" title="Beste CPA" campaignName={bestCpaCampaign.campaign_name} platform={bestCpaCampaign.platform} metric={fmtEur(bestCpaCampaign.cpa)} metricLabel="CPA" />
                    ) : (
                      <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>
                        Geen conversiedata beschikbaar
                      </div>
                    )}
                    {bestCpcCampaign ? (
                      <SpotlightCard badge="🖱️" badgeColor="#16A34A" title="Laagste CPC" campaignName={bestCpcCampaign.campaign_name} platform={bestCpcCampaign.platform} metric={fmtEur(bestCpcCampaign.cpc)} metricLabel="CPC" />
                    ) : (
                      <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>
                        Geen klikdata beschikbaar
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Campaign ranking */}
              <section>
                <h2 className="gf-eyebrow mb-5">Campagnes</h2>
                {loading ? <CampaignRankTableSkeleton /> : <CampaignRankTable rows={filteredRows} />}
              </section>

              {/* Google Ads (GA4-attributed) */}
              <section>
                <h2 className="gf-eyebrow mb-5">Google Ads — GA4</h2>
                <GoogleAdsWrapper dateFrom={dateFrom} dateTo={dateTo} />
              </section>

            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: SOLLICITATIES                                         */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'sollicitaties' && (
          <SollicitatiesSection dateFrom={dateFrom} dateTo={dateTo} />
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: GA4                                                   */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'ga4' && (
          <AnalyticsSection
            dateFrom={dateFrom}
            dateTo={dateTo}
            liSpend={liTotals.spend}
            meSpend={meTotals.spend}
          />
        )}

      </div>
    </main>
  );
}
