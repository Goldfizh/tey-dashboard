'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import KpiCard, { KpiCardSkeleton } from '@/components/KpiCard';
import ChannelCard, { ChannelCardSkeleton } from '@/components/ChannelCard';
import CampaignRankTable, { CampaignRankTableSkeleton } from '@/components/CampaignRankTable';
import CpaTrendChart, { CpaTrendChartSkeleton } from '@/components/CpaTrendChart';
import PacingTable, { PacingTableSkeleton } from '@/components/PacingTable';
import DailyDeliveryChart, { DailyDeliveryChartSkeleton } from '@/components/DailyDeliveryChart';
import AnalyticsSection from '@/components/AnalyticsSection';
import SollicitatiesSection from '@/components/SollicitatiesSection';
import GoogleAdsWrapper from '@/components/GoogleAdsWrapper';
import CampaignSidebar from '@/components/CampaignSidebar';
import AnalyseTab from '@/components/AnalyseTab';
import ChatPanel from '@/components/ChatPanel';
import type { DashboardContext } from '@/app/api/chat/route';
import type { CampaignRow, Platform } from '@/types/campaign';
import { sumRows } from '@/types/campaign';
import type { Objective } from '@/types/objective';
import { autoDetectObjective } from '@/types/objective';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString('nl-NL');
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

// ── Date helpers ──────────────────────────────────────────────────────────────
type Preset = 'week' | '14days' | 'month' | '3months' | 'custom';
type Tab    = 'ads' | 'analyse' | 'ga4' | 'sollicitaties';

function fmt(d: Date) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function presetRange(preset: Preset, customFrom: string, customTo: string) {
  if (preset === 'custom') return { from: customFrom, to: customTo };
  const today = new Date();
  const to    = fmt(today);
  if (preset === 'week') {
    const day  = today.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    const mon  = new Date(today);
    mon.setDate(today.getDate() - diff);
    return { from: fmt(mon), to };
  }
  if (preset === '14days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    return { from: fmt(start), to };
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
  const [tab,        setTab]        = useState<Tab>('ads');
  const [preset,     setPreset]     = useState<Preset>('3months');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  // Campaign selector
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  // Compare toggle
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Sidebar open state (persisted)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const s = localStorage.getItem('tey_sidebar');
    return s !== null ? s === 'true' : true;
  });

  // Manual objective override (persisted)
  const [manualObjective, setManualObjective] = useState<Objective | null>(() => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem('tey_objective') as Objective | null);
  });

  // Persist sidebarOpen
  useEffect(() => { localStorage.setItem('tey_sidebar', String(sidebarOpen)); }, [sidebarOpen]);

  // Persist manualObjective
  useEffect(() => {
    if (manualObjective) localStorage.setItem('tey_objective', manualObjective);
    else localStorage.removeItem('tey_objective');
  }, [manualObjective]);

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

  // Running campaigns = recent activity in last 7 days of available data.
  // Robust to data lag: uses dataset max date, not wall-clock today.
  const runningCampaigns = useMemo(() => {
    if (rows.length === 0) return new Set<string>();
    const maxByCampaign = new Map<string, string>();
    let datasetMax = '';
    for (const r of rows) {
      if (r.date > datasetMax) datasetMax = r.date;
      const cur = maxByCampaign.get(r.campaign_name);
      if (!cur || r.date > cur) maxByCampaign.set(r.campaign_name, r.date);
    }
    const cutoffMs = new Date(datasetMax + 'T00:00:00').getTime() - 7 * 86_400_000;
    const cutoff   = fmt(new Date(cutoffMs));
    const running  = new Set<string>();
    for (const [name, lastDate] of maxByCampaign) {
      if (lastDate >= cutoff) running.add(name);
    }
    return running;
  }, [rows]);

  // Smart campaign selection initialisation with localStorage persistence.
  // Default = running campaigns only, so the marketeer lands on what's NOW relevant.
  const hasInitCampaignsRef = useRef(false);

  useEffect(() => {
    if (rows.length === 0) return;
    const allNames = new Set(rows.map((r) => r.campaign_name));
    if (!hasInitCampaignsRef.current) {
      hasInitCampaignsRef.current = true;
      try {
        const saved = localStorage.getItem('tey_campaigns');
        if (saved) {
          const arr   = JSON.parse(saved) as string[];
          const valid = new Set(arr.filter((c) => allNames.has(c)));
          if (valid.size > 0) { setSelectedCampaigns(valid); return; }
        }
      } catch { /* ignore */ }
      // No saved preference: default to running campaigns; fall back to all if none are running.
      setSelectedCampaigns(runningCampaigns.size > 0 ? new Set(runningCampaigns) : allNames);
    } else {
      // Refresh: keep current selection, reconcile
      setSelectedCampaigns((prev) => {
        const next = new Set([...prev].filter((c) => allNames.has(c)));
        return next.size > 0 ? next : allNames;
      });
    }
  }, [rows, runningCampaigns]);

  useEffect(() => {
    if (selectedCampaigns.size > 0)
      localStorage.setItem('tey_campaigns', JSON.stringify([...selectedCampaigns]));
  }, [selectedCampaigns]);

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

  // CPM, VTR, CPCV
  const liCpm = liTotals.impressions > 0 ? liTotals.spend / liTotals.impressions * 1000 : 0;
  const meCpm = meTotals.impressions > 0 ? meTotals.spend / meTotals.impressions * 1000 : 0;
  const goCpm = goTotals.impressions > 0 ? goTotals.spend / goTotals.impressions * 1000 : 0;

  const liVtr = liTotals.impressions > 0 ? (liTotals.thruplays ?? 0) / liTotals.impressions : 0;
  const meVtr = meTotals.impressions > 0 ? (meTotals.thruplays ?? 0) / meTotals.impressions : 0;
  const goVtr = goTotals.impressions > 0 ? (goTotals.thruplays ?? 0) / goTotals.impressions : 0;

  // Overall totals per objective type
  const totalThruplays = (liTotals.thruplays ?? 0) + (meTotals.thruplays ?? 0) + (goTotals.thruplays ?? 0);
  const overallCpcv    = totalThruplays  > 0 ? totals.spend / totalThruplays  : null;
  const overallCpm     = totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : null;

  // ── Winner logic per objective ──────────────────────────────────────────────

  // CPA winners (conversies/leads)
  const cpas    = [liCpa, meCpa, goCpa];
  const minCpa  = Math.min(...cpas.filter((c): c is number => c !== null));
  const liWins  = liCpa !== null && liCpa === minCpa;
  const meWins  = meCpa !== null && meCpa === minCpa && !liWins;
  const goWins  = goCpa !== null && goCpa === minCpa && !liWins && !meWins;
  const bestChannel = liWins ? 'LinkedIn' : meWins ? 'Meta' : goWins ? 'Google Ads' : '—';

  // CPCV winners (video)
  const cpvMin       = Math.min(...[liCpv, meCpv, goCpv].filter((c): c is number => c !== null));
  const liVideoWins  = liCpv !== null && liCpv === cpvMin;
  const meVideoWins  = meCpv !== null && meCpv === cpvMin && !liVideoWins;
  const goVideoWins  = goCpv !== null && goCpv === cpvMin && !liVideoWins && !meVideoWins;
  const bestVideoChannel = liVideoWins ? 'LinkedIn' : meVideoWins ? 'Meta' : goVideoWins ? 'Google Ads' : '—';

  // CPM winners (impressies/verkeer)
  const cpmMin      = Math.min(...[liCpm, meCpm, goCpm].filter(Boolean));
  const liCpmWins   = liCpm > 0 && liCpm === cpmMin;
  const meCpmWins   = meCpm > 0 && meCpm === cpmMin && !liCpmWins;
  const goCpmWins   = goCpm > 0 && goCpm === cpmMin && !liCpmWins && !meCpmWins;
  const bestCpmChannel = liCpmWins ? 'LinkedIn' : meCpmWins ? 'Meta' : goCpmWins ? 'Google Ads' : '—';

  // Previous period computation
  const { prevFrom, prevTo } = useMemo(() => {
    if (!compareEnabled || !dateFrom || !dateTo) return { prevFrom: '', prevTo: '' };
    const fromD = new Date(dateFrom + 'T00:00:00');
    const toD   = new Date(dateTo   + 'T00:00:00');
    const dur   = toD.getTime() - fromD.getTime();
    const pTo   = new Date(fromD.getTime() - 86400000);
    const pFrom = new Date(pTo.getTime()   - dur);
    return { prevFrom: fmt(pFrom), prevTo: fmt(pTo) };
  }, [compareEnabled, dateFrom, dateTo]);

  const prevRows = useMemo(() => {
    if (!compareEnabled || !prevFrom || !prevTo) return [] as CampaignRow[];
    return rows.filter((r) =>
      r.date >= prevFrom && r.date <= prevTo &&
      (selectedCampaigns.size === 0 || selectedCampaigns.has(r.campaign_name))
    );
  }, [compareEnabled, rows, prevFrom, prevTo, selectedCampaigns]);

  const prevTotals   = useMemo(() => sumRows(prevRows), [prevRows]);
  const prevLiTotals = useMemo(() => sumRows(prevRows.filter((r) => r.platform === 'linkedin')), [prevRows]);
  const prevMeTotals = useMemo(() => sumRows(prevRows.filter((r) => r.platform === 'meta')),     [prevRows]);
  const prevGoTotals = useMemo(() => sumRows(prevRows.filter((r) => r.platform === 'google')),   [prevRows]);
  const prevOverallCpa      = prevTotals.conversions   > 0 ? prevTotals.spend   / prevTotals.conversions   : null;
  const prevLiCpa           = prevLiTotals.conversions > 0 ? prevLiTotals.spend / prevLiTotals.conversions : null;
  const prevMeCpa           = prevMeTotals.conversions > 0 ? prevMeTotals.spend / prevMeTotals.conversions : null;
  const prevGoCpa           = prevGoTotals.conversions > 0 ? prevGoTotals.spend / prevGoTotals.conversions : null;
  const prevTotalThruplays  = (prevLiTotals.thruplays ?? 0) + (prevMeTotals.thruplays ?? 0) + (prevGoTotals.thruplays ?? 0);
  const prevOverallCpcv     = prevTotalThruplays > 0 ? prevTotals.spend / prevTotalThruplays : null;

  // Delta helper
  function delta(cur: number, prev: number): number | null {
    if (prev === 0) return null;
    return (cur - prev) / prev;
  }

  // Objective auto-detection
  const autoObjective = useMemo(() =>
    autoDetectObjective([...selectedCampaigns]),
    [selectedCampaigns],
  );
  const effectiveObjective: Objective = manualObjective ?? autoObjective;

  // Campaign summaries (spotlight + uitschieters)
  const campaignSummaries = useMemo(() => {
    const map = new Map<string, {
      platform:    Platform;
      spend:       number;
      applicants:  number;
      clicks:      number;
      impressions: number;
      thruplays:   number;
    }>();
    for (const r of filteredRows) {
      const key = `${r.platform}::${r.campaign_name}`;
      const cur = map.get(key) ?? { platform: r.platform, spend: 0, applicants: 0, clicks: 0, impressions: 0, thruplays: 0 };
      cur.spend       += r.spend;
      cur.applicants  += r.conversions;
      cur.clicks      += r.clicks;
      cur.impressions += r.impressions;
      cur.thruplays   += r.thruplays ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      campaign_name: key.split('::')[1],
      platform:      v.platform,
      spend:         v.spend,
      applicants:    v.applicants,
      clicks:        v.clicks,
      impressions:   v.impressions,
      thruplays:     v.thruplays,
      cpa:   v.applicants  > 0 ? v.spend / v.applicants  : Infinity,
      cpc:   v.clicks      > 0 ? v.spend / v.clicks      : Infinity,
      cpcv:  v.thruplays   > 0 ? v.spend / v.thruplays   : Infinity,
      cpm:   v.impressions > 0 ? v.spend / v.impressions * 1000 : Infinity,
      vtr:   v.impressions > 0 ? v.thruplays / v.impressions    : 0,
    }));
  }, [filteredRows]);

  const bestCpaCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.applicants > 0).sort((a, b) => a.cpa - b.cpa)[0] ?? null,
    [campaignSummaries],
  );
  const bestCpcCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.clicks > 0).sort((a, b) => a.cpc - b.cpc)[0] ?? null,
    [campaignSummaries],
  );
  const bestCpcvCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.thruplays > 0).sort((a, b) => a.cpcv - b.cpcv)[0] ?? null,
    [campaignSummaries],
  );
  const bestVtrCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.impressions > 0 && c.thruplays > 0).sort((a, b) => b.vtr - a.vtr)[0] ?? null,
    [campaignSummaries],
  );
  const bestCpmCampaign = useMemo(() =>
    [...campaignSummaries].filter((c) => c.impressions > 0).sort((a, b) => a.cpm - b.cpm)[0] ?? null,
    [campaignSummaries],
  );

  // ── Dashboard context for AI chat ─────────────────────────────────────────
  const dashboardContext = useMemo((): DashboardContext => {
    const presetLabel =
      preset === 'week'    ? 'Deze week' :
      preset === '14days'  ? '14 dagen' :
      preset === 'month'   ? 'Deze maand' :
      preset === '3months' ? 'Afgelopen 3 maanden' : 'Aangepaste periode';

    const topCampaigns = [...campaignSummaries]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((c) => ({
        name:        c.campaign_name,
        platform:    c.platform,
        spend:       c.spend,
        conversions: c.applicants,
        cpa:         c.cpa === Infinity ? null : c.cpa,
        clicks:      c.clicks,
        cpc:         c.cpc === Infinity ? 0 : c.cpc,
      }));

    return {
      period:   presetLabel,
      dateFrom: dateFrom ?? '',
      dateTo:   dateTo   ?? '',
      totals: {
        spend:       totals.spend,
        impressions: totals.impressions,
        clicks:      totals.clicks,
        conversions: totals.conversions,
        cpa:         overallCpa,
      },
      channels: {
        linkedin: liTotals.spend > 0 || liTotals.clicks > 0 ? {
          spend: liTotals.spend, clicks: liTotals.clicks, impressions: liTotals.impressions,
          conversions: liTotals.conversions, cpa: liCpa, ctr: liCtr, cpc: liCpc,
          thruplays: liTotals.thruplays ?? 0, cpv: liCpv,
        } : undefined,
        meta: meTotals.spend > 0 || meTotals.clicks > 0 ? {
          spend: meTotals.spend, clicks: meTotals.clicks, impressions: meTotals.impressions,
          conversions: meTotals.conversions, cpa: meCpa, ctr: meCtr, cpc: meCpc,
          thruplays: meTotals.thruplays ?? 0, cpv: meCpv,
        } : undefined,
        google: goTotals.spend > 0 || goTotals.clicks > 0 ? {
          spend: goTotals.spend, clicks: goTotals.clicks, impressions: goTotals.impressions,
          conversions: goTotals.conversions, cpa: goCpa, ctr: goCtr, cpc: goCpc,
        } : undefined,
      },
      topCampaigns,
      bestCpaCampaign: bestCpaCampaign ? {
        name:        bestCpaCampaign.campaign_name,
        platform:    bestCpaCampaign.platform,
        spend:       bestCpaCampaign.spend,
        conversions: bestCpaCampaign.applicants,
        cpa:         bestCpaCampaign.cpa === Infinity ? null : bestCpaCampaign.cpa,
        clicks:      bestCpaCampaign.clicks,
        cpc:         bestCpaCampaign.cpc === Infinity ? 0 : bestCpaCampaign.cpc,
      } : null,
    };
  }, [
    preset, dateFrom, dateTo, totals, overallCpa,
    liTotals, meTotals, goTotals, liCpa, meCpa, goCpa,
    liCtr, meCtr, goCtr, liCpc, meCpc, goCpc, liCpv, meCpv,
    campaignSummaries, bestCpaCampaign,
  ]);

  // Per-platform campaign lists for the sidebar
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
    { key: '14days',  label: '14 dagen' },
    { key: 'month',   label: 'Deze maand' },
    { key: '3months', label: '3 maanden' },
    { key: 'custom',  label: 'Aangepast' },
  ];

  // ── Dynamic comparison table rows based on objective ─────────────────────
  const comparisonRows = (() => {
    const tableRows: Array<{ label: string; li: string; me: string; go: string; liR: number; meR: number; goR: number; lower?: boolean; neutral?: boolean }> = [
      { label: 'Budget',      li: fmtEur(liTotals.spend),           me: fmtEur(meTotals.spend),           go: fmtEur(goTotals.spend),           liR: liTotals.spend,        meR: meTotals.spend,        goR: goTotals.spend,        neutral: true },
      { label: 'CPM',         li: liCpm > 0 ? fmtEur(liCpm) : '—', me: meCpm > 0 ? fmtEur(meCpm) : '—', go: goCpm > 0 ? fmtEur(goCpm) : '—', liR: liCpm,                 meR: meCpm,                 goR: goCpm,                 lower: true },
      { label: 'Impressies',  li: fmtNum(liTotals.impressions),      me: fmtNum(meTotals.impressions),      go: fmtNum(goTotals.impressions),      liR: liTotals.impressions,  meR: meTotals.impressions,  goR: goTotals.impressions },
      { label: 'Clicks',      li: fmtNum(liTotals.clicks),           me: fmtNum(meTotals.clicks),           go: fmtNum(goTotals.clicks),           liR: liTotals.clicks,       meR: meTotals.clicks,       goR: goTotals.clicks },
      { label: 'CTR',         li: fmtPct(liCtr),                     me: fmtPct(meCtr),                     go: fmtPct(goCtr),                     liR: liCtr,                 meR: meCtr,                 goR: goCtr },
      { label: 'Kosten/klik', li: liCpc > 0 ? fmtEur(liCpc) : '—', me: meCpc > 0 ? fmtEur(meCpc) : '—', go: goCpc > 0 ? fmtEur(goCpc) : '—', liR: liCpc,                 meR: meCpc,                 goR: goCpc,                 lower: true },
    ];

    if (effectiveObjective === 'video') {
      tableRows.push(
        { label: 'Completed views', li: (liTotals.thruplays ?? 0) > 0 ? fmtNum(liTotals.thruplays ?? 0) : '—', me: (meTotals.thruplays ?? 0) > 0 ? fmtNum(meTotals.thruplays ?? 0) : '—', go: (goTotals.thruplays ?? 0) > 0 ? fmtNum(goTotals.thruplays ?? 0) : '—', liR: liTotals.thruplays ?? 0, meR: meTotals.thruplays ?? 0, goR: goTotals.thruplays ?? 0 },
        { label: 'CPCV',            li: liCpv != null ? fmtEur(liCpv) : '—',                                   me: meCpv != null ? fmtEur(meCpv) : '—',                                   go: goCpv != null ? fmtEur(goCpv) : '—',                                   liR: liCpv ?? 0,              meR: meCpv ?? 0,              goR: goCpv ?? 0,              lower: true },
        { label: 'VTR',             li: liVtr > 0 ? fmtPct(liVtr) : '—',                                       me: meVtr > 0 ? fmtPct(meVtr) : '—',                                       go: goVtr > 0 ? fmtPct(goVtr) : '—',                                       liR: liVtr,                   meR: meVtr,                   goR: goVtr },
      );
    } else if (effectiveObjective === 'impressies' || effectiveObjective === 'verkeer') {
      // No conversion rows; already have CPM above
    } else {
      // conversies or leads (default)
      const convLabel = effectiveObjective === 'leads' ? 'Leads' : 'Sollicitanten';
      const cpaLabel  = effectiveObjective === 'leads' ? 'CPL'   : 'Kosten/soll.';
      tableRows.push(
        { label: convLabel, li: fmtNum(liTotals.conversions),                              me: fmtNum(meTotals.conversions),                              go: fmtNum(goTotals.conversions),                              liR: liTotals.conversions,  meR: meTotals.conversions,  goR: goTotals.conversions },
        { label: cpaLabel,  li: liCpa != null ? fmtEur(liCpa) : '—',                      me: meCpa != null ? fmtEur(meCpa) : '—',                      go: goCpa != null ? fmtEur(goCpa) : '—',                      liR: liCpa ?? 0,            meR: meCpa ?? 0,            goR: goCpa ?? 0,            lower: true },
      );
    }
    return tableRows;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen" style={{ background: '#F0F4F8' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <div className="max-w-[1280px] mx-auto px-6 h-16 grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>

          {/* Logo — left */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teylingereind-logo.svg"
            alt="Teylingereind"
            style={{ height: '36px', width: 'auto', display: 'block' }}
          />

          {/* Nav — center */}
          <nav className="flex items-center">
            {([
              { key: 'ads' as Tab,           label: 'Advertenties' },
              { key: 'analyse' as Tab,       label: 'Analyse' },
              { key: 'sollicitaties' as Tab, label: 'Sollicitaties' },
              { key: 'ga4' as Tab,           label: 'GA4 — Website' },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative h-16 px-6 text-sm transition-colors"
                  style={{
                    fontWeight: active ? 700 : 500,
                    color: active ? '#12101F' : '#8C9BAF',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#555E6C'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#8C9BAF'; }}
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

          {/* Vernieuwen — right */}
          <div className="flex justify-end">
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-sm font-semibold disabled:opacity-40 transition-colors px-5 py-2 rounded-lg"
              style={{ background: '#6331F4', color: '#ffffff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#5436CE')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#6331F4')}
            >
              {loading ? 'Laden…' : '↺ Vernieuwen'}
            </button>
          </div>

        </div>
      </header>

      {/* ── Filters bar (sticky below header) ───────────────────── */}
      <div className="sticky top-16 z-10 bg-white" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <div className="max-w-[1280px] mx-auto px-6">

          {/* Period presets */}
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
                {new Date(dateFrom + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                {' '}–{' '}
                {new Date(dateTo + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}

            {/* Compare toggle */}
            <button
              onClick={() => setCompareEnabled((c) => !c)}
              className="text-xs font-semibold px-3 py-1.5 transition-all"
              style={{
                borderRadius: '4px',
                background: compareEnabled ? '#6331F414' : '#ffffff',
                color:      compareEnabled ? '#6331F4'   : '#555E6C',
                border:     `1px solid ${compareEnabled ? '#6331F4' : '#DCE0E6'}`,
              }}
            >
              ↔ Vergelijk
            </button>

            {compareEnabled && prevFrom && (
              <span className="text-xs ml-1" style={{ color: '#8C9BAF' }}>
                vs. {prevFrom} – {prevTo}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-6 py-8">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-10">
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
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <CampaignSidebar
              open={sidebarOpen}
              onToggle={() => setSidebarOpen((o) => !o)}
              liCampaigns={liCampaigns}
              meCampaigns={meCampaigns}
              goCampaigns={goCampaigns}
              selected={selectedCampaigns}
              onSelect={setSelectedCampaigns}
              runningCampaigns={runningCampaigns}
              autoObjective={autoObjective}
              manualObjective={manualObjective}
              onObjective={setManualObjective}
            />
            <div style={{ flex: 1, minWidth: 0 }} className="space-y-10">

              {/* Top KPIs */}
              <section>
                <h2 className="gf-eyebrow mb-5">Totaaloverzicht</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
                  ) : (
                    <>
                      {/* Card 1: Budget — always shown */}
                      <KpiCard
                        title="Budget gespendeerd"
                        value={fmtEur(totals.spend)}
                        subtitle="Alle kanalen"
                        delta={compareEnabled ? delta(totals.spend, prevTotals.spend) : null}
                        deltaInverted={false}
                      />

                      {/* Cards 2–4: objective-aware */}
                      {effectiveObjective === 'video' ? (
                        <>
                          <KpiCard
                            title="Completed views"
                            value={fmtNum(totalThruplays)}
                            subtitle="Voltooide video views"
                            delta={compareEnabled ? delta(totalThruplays, prevTotalThruplays) : null}
                            deltaInverted={false}
                          />
                          <KpiCard
                            title="Kosten per video view"
                            value={overallCpcv !== null ? fmtEur(overallCpcv) : '—'}
                            subtitle="Spend ÷ completed views"
                            delta={compareEnabled && overallCpcv !== null && prevOverallCpcv !== null ? delta(overallCpcv, prevOverallCpcv) : null}
                            deltaInverted={true}
                          />
                          <KpiCard
                            title="Beste kanaal"
                            value={bestVideoChannel}
                            accent={bestVideoChannel !== '—'}
                            subtitle={bestVideoChannel !== '—' && isFinite(cpvMin) ? `Laagste CPCV: ${fmtEur(cpvMin)}` : 'Geen videodata'}
                          />
                        </>
                      ) : effectiveObjective === 'impressies' || effectiveObjective === 'verkeer' ? (
                        <>
                          <KpiCard
                            title="Impressies"
                            value={fmtNum(totals.impressions)}
                            subtitle="Totaal bereik"
                            delta={compareEnabled ? delta(totals.impressions, prevTotals.impressions) : null}
                            deltaInverted={false}
                          />
                          <KpiCard
                            title="CPM"
                            value={overallCpm !== null ? fmtEur(overallCpm) : '—'}
                            subtitle="Kosten per 1000 impressies"
                            delta={compareEnabled && overallCpm !== null && prevTotals.impressions > 0
                              ? delta(overallCpm, prevTotals.spend / prevTotals.impressions * 1000) : null}
                            deltaInverted={true}
                          />
                          <KpiCard
                            title="Beste kanaal"
                            value={bestCpmChannel}
                            accent={bestCpmChannel !== '—'}
                            subtitle={bestCpmChannel !== '—' && isFinite(cpmMin) && cpmMin > 0 ? `Laagste CPM: ${fmtEur(cpmMin)}` : 'Geen data'}
                          />
                        </>
                      ) : (
                        /* conversies / leads (default) */
                        <>
                          <KpiCard
                            title={effectiveObjective === 'leads' ? 'Totaal leads' : 'Totaal sollicitanten'}
                            value={fmtNum(totals.conversions)}
                            subtitle="LinkedIn · Meta · Google Ads"
                            delta={compareEnabled ? delta(totals.conversions, prevTotals.conversions) : null}
                            deltaInverted={false}
                          />
                          <KpiCard
                            title={effectiveObjective === 'leads' ? 'Kosten per lead' : 'Kosten per sollicitant'}
                            value={overallCpa !== null ? fmtEur(overallCpa) : '—'}
                            subtitle="Spend ÷ conversies"
                            delta={compareEnabled && overallCpa !== null && prevOverallCpa !== null ? delta(overallCpa, prevOverallCpa) : null}
                            deltaInverted={true}
                          />
                          <KpiCard
                            title="Beste kanaal"
                            value={bestChannel}
                            accent={bestChannel !== '—'}
                            subtitle={bestChannel !== '—' && isFinite(minCpa) ? `Laagste CPA: ${fmtEur(minCpa)}` : 'Geen conversiedata'}
                          />
                        </>
                      )}
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
                      <ChannelCard platform="linkedin" spend={liTotals.spend} applicants={liTotals.conversions} clicks={liTotals.clicks} impressions={liTotals.impressions} thruplays={liTotals.thruplays ?? 0}
                        isWinner={effectiveObjective === 'video' ? liVideoWins : (effectiveObjective === 'impressies' || effectiveObjective === 'verkeer') ? liCpmWins : liWins}
                        objective={effectiveObjective} />
                      <ChannelCard platform="meta"     spend={meTotals.spend} applicants={meTotals.conversions} clicks={meTotals.clicks} impressions={meTotals.impressions} thruplays={meTotals.thruplays ?? 0}
                        isWinner={effectiveObjective === 'video' ? meVideoWins : (effectiveObjective === 'impressies' || effectiveObjective === 'verkeer') ? meCpmWins : meWins}
                        objective={effectiveObjective} />
                      <ChannelCard platform="google"   spend={goTotals.spend} applicants={goTotals.conversions} clicks={goTotals.clicks} impressions={goTotals.impressions} thruplays={goTotals.thruplays ?? 0}
                        isWinner={effectiveObjective === 'video' ? goVideoWins : (effectiveObjective === 'impressies' || effectiveObjective === 'verkeer') ? goCpmWins : goWins}
                        objective={effectiveObjective} />
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
                        {comparisonRows.map(({ label, li, me, go, liR, meR, goR, lower, neutral }) => {
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

              {/* Trend line – metric auto-adapts to objective, platforms toggleable */}
              <section>
                <h2 className="gf-eyebrow mb-5">Trendlijn per dag</h2>
                {loading
                  ? <CpaTrendChartSkeleton />
                  : <CpaTrendChart rows={filteredRows} objective={effectiveObjective} />
                }
              </section>

              {/* Uitschieters – objective-aware */}
              <section>
                <h2 className="gf-eyebrow mb-5">Uitschieters</h2>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <KpiCardSkeleton /><KpiCardSkeleton />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {effectiveObjective === 'video' ? (
                      <>
                        {bestCpcvCampaign ? (
                          <SpotlightCard badge="🏆" badgeColor="#16A34A" title="Laagste CPCV" campaignName={bestCpcvCampaign.campaign_name} platform={bestCpcvCampaign.platform} metric={fmtEur(bestCpcvCampaign.cpcv)} metricLabel="CPCV" />
                        ) : (
                          <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>Geen video view data beschikbaar</div>
                        )}
                        {bestVtrCampaign ? (
                          <SpotlightCard badge="▶️" badgeColor="#6331F4" title="Hoogste VTR" campaignName={bestVtrCampaign.campaign_name} platform={bestVtrCampaign.platform} metric={fmtPct(bestVtrCampaign.vtr)} metricLabel="VTR" />
                        ) : (
                          <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>Geen VTR data beschikbaar</div>
                        )}
                      </>
                    ) : effectiveObjective === 'impressies' || effectiveObjective === 'verkeer' ? (
                      <>
                        {bestCpmCampaign ? (
                          <SpotlightCard badge="📡" badgeColor="#16A34A" title="Laagste CPM" campaignName={bestCpmCampaign.campaign_name} platform={bestCpmCampaign.platform} metric={fmtEur(bestCpmCampaign.cpm)} metricLabel="CPM" />
                        ) : (
                          <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>Geen CPM data beschikbaar</div>
                        )}
                        {bestCpcCampaign ? (
                          <SpotlightCard badge="🖱️" badgeColor="#16A34A" title="Laagste CPC" campaignName={bestCpcCampaign.campaign_name} platform={bestCpcCampaign.platform} metric={fmtEur(bestCpcCampaign.cpc)} metricLabel="CPC" />
                        ) : (
                          <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>Geen klikdata beschikbaar</div>
                        )}
                      </>
                    ) : (
                      /* conversies / leads */
                      <>
                        {bestCpaCampaign ? (
                          <SpotlightCard badge="🏆" badgeColor="#16A34A" title={effectiveObjective === 'leads' ? 'Beste CPL' : 'Beste CPA'} campaignName={bestCpaCampaign.campaign_name} platform={bestCpaCampaign.platform} metric={fmtEur(bestCpaCampaign.cpa)} metricLabel={effectiveObjective === 'leads' ? 'CPL' : 'CPA'} />
                        ) : (
                          <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>Geen conversiedata beschikbaar</div>
                        )}
                        {bestCpcCampaign ? (
                          <SpotlightCard badge="🖱️" badgeColor="#16A34A" title="Laagste CPC" campaignName={bestCpcCampaign.campaign_name} platform={bestCpcCampaign.platform} metric={fmtEur(bestCpcCampaign.cpc)} metricLabel="CPC" />
                        ) : (
                          <div className="bg-white rounded-lg p-5 text-sm" style={{ border: '1px solid #DCE0E6', color: '#8C9BAF' }}>Geen klikdata beschikbaar</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* Campaign table */}
              <section>
                <h2 className="gf-eyebrow mb-5">Campagnes</h2>
                {loading
                  ? <CampaignRankTableSkeleton />
                  : <CampaignRankTable rows={filteredRows} objective={effectiveObjective} />
                }
              </section>

              {/* Daily delivery per campaign */}
              <section>
                <h2 className="gf-eyebrow mb-5">Dagelijkse uitlevering per campagne</h2>
                {loading
                  ? <DailyDeliveryChartSkeleton />
                  : <DailyDeliveryChart
                      allRows={rows.filter((r) => selectedCampaigns.size === 0 || selectedCampaigns.has(r.campaign_name))}
                      filteredRows={filteredRows}
                    />
                }
              </section>

              {/* Pacing table */}
              <section>
                <h2 className="gf-eyebrow mb-5">Pacing</h2>
                {loading
                  ? <PacingTableSkeleton />
                  : <PacingTable allRows={rows} filteredRows={filteredRows} dateTo={dateTo} />
                }
              </section>

              {/* Google Ads (GA4-attributed) */}
              <section>
                <h2 className="gf-eyebrow mb-5">Google Ads — GA4</h2>
                <GoogleAdsWrapper dateFrom={dateFrom} dateTo={dateTo} />
              </section>

            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: ANALYSE                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'analyse' && (
          <AnalyseTab rows={rows} loading={loading} />
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

      {/* ── AI Chat ──────────────────────────────────────────────────── */}
      {!loading && <ChatPanel context={dashboardContext} />}

    </main>
  );
}
