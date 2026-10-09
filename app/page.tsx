'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PacingSummary from '@/components/PacingSummary';
import TotalsResultsTable from '@/components/TotalsResultsTable';
import ResultsPerChannelTable from '@/components/ResultsPerChannelTable';
import MetricPairManager from '@/components/MetricPairManager';
import KanalenTab from '@/components/KanalenTab';
import AnalyseTab from '@/components/AnalyseTab';
import AnalyticsSection from '@/components/AnalyticsSection';
import SollicitatiesSection from '@/components/SollicitatiesSection';
import type { ChannelResultRow, MetricPairDef, Pacing } from '@/types/results';
import { DEFAULT_METRIC_PAIRS, kpiToSpendVolumes, sumSpendVolumes } from '@/types/results';
import { buildSeedKpiRows } from '@/lib/seedKpiTargets';
import { applyAchievedByLabel } from '@/lib/resultsAdapter';
import type { CampaignRow } from '@/types/campaign';
import { sumRows } from '@/types/campaign';
import type { ConversionBySource, ConversionByJob, ApplicationStart } from '@/lib/analytics';

// ── Date helpers ──────────────────────────────────────────────────────────────
type Preset = 'week' | '14days' | 'month' | '3months' | 'custom';
type Tab = 'totaal' | 'kanalen' | 'analyse' | 'sollicitaties' | 'ga4';

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  const to = fmt(today);
  if (preset === 'custom') return { from: customFrom, to: customTo || to };
  const start = new Date(today);
  if (preset === 'week') start.setDate(today.getDate() - 7);
  else if (preset === '14days') start.setDate(today.getDate() - 14);
  else if (preset === 'month') start.setMonth(today.getMonth() - 1);
  else start.setMonth(today.getMonth() - 3); // 3months
  return { from: fmt(start), to };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week', label: '7 dagen' },
  { key: '14days', label: '14 dagen' },
  { key: 'month', label: '1 maand' },
  { key: '3months', label: '3 maanden' },
  { key: 'custom', label: 'Aangepast' },
];

const NAV_TABS: { key: Tab; label: string }[] = [
  { key: 'totaal', label: 'Totaaloverzicht' },
  { key: 'kanalen', label: 'Kanalen' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'sollicitaties', label: 'Sollicitaties' },
  { key: 'ga4', label: 'GA4 — Website' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('totaal');

  // Ruwe campagnedata (Meta/LinkedIn/YouTube via Sheets + Google Ads via GA4-attributie) —
  // gedeeld door Totaaloverzicht/Kanalen/Analyse (nieuw) én Sollicitaties/GA4 — Website
  // (ongewijzigd — die twee hebben channelSpend/liSpend/meSpend nodig voor hun
  // kosten-per-sollicitatie-berekening).
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const google: CampaignRow[] = googleRes.ok ? await googleRes.json() : [];
      setRows([...campaigns, ...google]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Periode — alleen relevant voor Sollicitaties/GA4 — Website (Totaaloverzicht/Kanalen/
  // Analyse tonen achieved-to-date t.o.v. de eigen pacing-periode, net als in goldfizh-dashboard).
  const [preset, setPreset] = useState<Preset>('3months');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { from: dateFrom, to: dateTo } = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  // Real applications (GA4 / Recruitee) for the selected period — channel-attributed.
  const [analytics, setAnalytics] = useState<{
    conversionsBySource: ConversionBySource[];
    conversionsByJob: ConversionByJob[];
    applicationStarts: ApplicationStart[];
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    let cancelled = false;
    setAnalyticsLoading(true);
    fetch(`/api/analytics?startDate=${dateFrom}&endDate=${dateTo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setAnalytics(d); })
      .catch(() => { if (!cancelled) setAnalytics(null); })
      .finally(() => { if (!cancelled) setAnalyticsLoading(false); });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() =>
    rows.filter((r) => (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo)),
    [rows, dateFrom, dateTo],
  );

  // Volledige kanaalspend voor de periode (t.b.v. Sollicitaties/GA4 — Website's
  // kosten-per-sollicitatie). YouTube zit hier bewust niet in — die twee tabs kennen alleen
  // linkedin/meta/google, en YouTube-attributie via GA4 bestaat nog niet.
  const channelSpendFull = useMemo(() => {
    const s = { linkedin: 0, meta: 0, google: 0 };
    for (const r of filtered) {
      if (r.platform === 'linkedin') s.linkedin += r.spend;
      else if (r.platform === 'meta') s.meta += r.spend;
      else if (r.platform === 'google') s.google += r.spend;
    }
    return s;
  }, [filtered]);

  const spendMissing = useMemo(() => {
    const agg: Record<'linkedin' | 'meta' | 'google', { s: number; a: number }> = {
      linkedin: { s: 0, a: 0 }, meta: { s: 0, a: 0 }, google: { s: 0, a: 0 },
    };
    for (const r of filtered) {
      if (r.platform === 'youtube') continue;
      agg[r.platform].s += r.spend;
      agg[r.platform].a += r.impressions + r.clicks;
    }
    return {
      linkedin: agg.linkedin.s === 0 && agg.linkedin.a > 0,
      meta: agg.meta.s === 0 && agg.meta.a > 0,
      google: agg.google.s === 0 && agg.google.a > 0,
    };
  }, [filtered]);

  const liTotals = useMemo(() => sumRows(filtered.filter((r) => r.platform === 'linkedin')), [filtered]);
  const meTotals = useMemo(() => sumRows(filtered.filter((r) => r.platform === 'meta')), [filtered]);

  // ── Totaaloverzicht / Kanalen / Analyse — editable resultaten-per-kanaal + budget/pacing.
  // Volledig handmatig samengesteld (zie buildSeedKpiRows in lib/seedKpiTargets.ts) — geen
  // automatische koppeling met /api/campaigns, zie de toelichting verderop in dit bestand.
  const [resultRows, setResultRows] = useState<ChannelResultRow[]>([]);
  const [pacing, setPacing] = useState<Pacing>({ startDate: '', endDate: '' });
  const [metricPairs, setMetricPairs] = useState<MetricPairDef[]>(DEFAULT_METRIC_PAIRS);
  const [hasLoadedPersisted, setHasLoadedPersisted] = useState(false);

  useEffect(() => {
    try {
      const savedRows = localStorage.getItem('tey_results_rows_v8');
      // Eerste bezoek (nog niks opgeslagen): start met de KPI-targets (en, voor Meta, een
      // handmatig opgehaalde achieved-snapshot) uit buildSeedKpiRows() i.p.v. een lege tabel.
      if (savedRows) setResultRows(JSON.parse(savedRows) as ChannelResultRow[]);
      else setResultRows(buildSeedKpiRows());
      const savedPacing = localStorage.getItem('tey_pacing_v8');
      if (savedPacing) setPacing(JSON.parse(savedPacing) as Pacing);
      const savedMetrics = localStorage.getItem('tey_metric_pairs_v8');
      if (savedMetrics) setMetricPairs(JSON.parse(savedMetrics) as MetricPairDef[]);
    } catch { /* ignore */ }
    setHasLoadedPersisted(true);
  }, []);

  // LET OP: hier stond een automatische merge die bij elke /api/campaigns-fetch alle kanaal/
  // campagne-combinaties uit de Sheets-export in resultRows zette (via mergeAchieved). Zodra de
  // Sheets-koppeling werkt, bevat die feed ALLE actieve Meta/LinkedIn-campagnes van Teylingereind
  // (tientallen, niet alleen deze mediaplan-selectie), dus dat voegde dubbele/extra rijen toe
  // naast de 10 hieronder. Totaaloverzicht/Kanalen/Analyse tonen daarom nu uitsluitend de
  // handmatig samengestelde lijst uit buildSeedKpiRows() (incl. een handmatig opgehaalde Meta-
  // achieved-snapshot) — geen automatische koppeling meer, tot er per kanaal een nette 1-op-1
  // koppeling (mediaplan-campagne -> echte advertentie-entiteit) is gebouwd.

  // LinkedIn is wél live gekoppeld (/api/linkedin/campaigns, rechtstreeks de LinkedIn Marketing
  // API — zie lib/linkedin.ts), gescopet op precies de 3 bekende campagnes. De respons komt al
  // gekeyed op campagnelabel terug, dus hier is geen naam-matching nodig — alleen de 3
  // bijbehorende rijen worden ververst, de rest van resultRows blijft ongemoeid.
  const [linkedInStatus, setLinkedInStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [linkedInError, setLinkedInError] = useState<string | null>(null);

  const fetchLinkedIn = useCallback(async () => {
    setLinkedInStatus('loading');
    setLinkedInError(null);
    try {
      const res = await fetch('/api/linkedin/campaigns');
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setResultRows((prev) => applyAchievedByLabel(prev, 'LinkedIn', data));
      setLinkedInStatus('idle');
    } catch (err) {
      setLinkedInStatus('error');
      setLinkedInError(err instanceof Error ? err.message : 'Onbekende fout bij het laden van LinkedIn-data');
    }
  }, []);

  useEffect(() => { if (hasLoadedPersisted) fetchLinkedIn(); }, [hasLoadedPersisted, fetchLinkedIn]);

  useEffect(() => { if (hasLoadedPersisted) localStorage.setItem('tey_results_rows_v8', JSON.stringify(resultRows)); }, [resultRows, hasLoadedPersisted]);
  useEffect(() => { if (hasLoadedPersisted) localStorage.setItem('tey_pacing_v8', JSON.stringify(pacing)); }, [pacing, hasLoadedPersisted]);
  useEffect(() => { if (hasLoadedPersisted) localStorage.setItem('tey_metric_pairs_v8', JSON.stringify(metricPairs)); }, [metricPairs, hasLoadedPersisted]);

  const resultsAchievedSpend = useMemo(
    () => resultRows.reduce((sum, r) => sum + r.achieved.spend, 0),
    [resultRows],
  );
  const resultsKpiSpend = useMemo(
    () => sumSpendVolumes(resultRows.map((r) => kpiToSpendVolumes(r.kpi, metricPairs))).spend,
    [resultRows, metricPairs],
  );
  const activeUnion = useMemo(
    () => metricPairs.filter((p) => resultRows.some((r) => r.activePairKeys.includes(p.key))),
    [metricPairs, resultRows],
  );

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
            {NAV_TABS.map(({ key, label }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative h-16 px-6 text-sm transition-colors"
                  style={{
                    fontWeight: active ? 700 : 500,
                    color: active ? '#0B1020' : '#8C9BAF',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#555E6C'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#8C9BAF'; }}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-4 right-4"
                      style={{ height: '2px', background: '#1E3A8A', borderRadius: '2px 2px 0 0' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Vernieuwen — right */}
          <div className="flex justify-end">
            <button
              onClick={() => { fetchData(); fetchLinkedIn(); }}
              disabled={loading}
              className="text-sm font-semibold disabled:opacity-40 transition-colors px-5 py-2 rounded-lg"
              style={{ background: '#1E3A8A', color: '#ffffff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#16295E')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1E3A8A')}
            >
              {loading ? 'Laden…' : '↺ Vernieuwen'}
            </button>
          </div>

        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-6 py-8">

        {error && (
          <div className="mb-6 text-sm px-4 py-3 rounded-lg" style={{ background: '#FEF2F2', color: '#B42318', border: '1px solid #FCA5A5' }}>
            {error}
            <button onClick={fetchData} className="ml-2 font-semibold underline">Opnieuw proberen</button>
          </div>
        )}

        {linkedInStatus === 'error' && (
          <div className="mb-6 text-sm px-4 py-3 rounded-lg" style={{ background: '#FEF2F2', color: '#B42318', border: '1px solid #FCA5A5' }}>
            LinkedIn: {linkedInError}
            <button onClick={fetchLinkedIn} className="ml-2 font-semibold underline">Opnieuw proberen</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: TOTAALOVERZICHT                                          */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'totaal' && (
          <div className="space-y-8">
            <div>
              <h2 className="gf-eyebrow mb-5">Budget &amp; voortgang</h2>
              <PacingSummary pacing={pacing} onChange={setPacing} achievedSpend={resultsAchievedSpend} kpiSpendTotal={resultsKpiSpend} />
            </div>
            <div>
              <h2 className="gf-eyebrow mb-5">Totaalresultaten — alle kanalen</h2>
              <TotalsResultsTable rows={resultRows} metricPairs={activeUnion} />
            </div>
            <div>
              <h2 className="gf-eyebrow mb-5">Resultaten per kanaal &amp; campagne</h2>
              <MetricPairManager catalog={metricPairs} onChange={setMetricPairs} />
              <ResultsPerChannelTable rows={resultRows} onChange={setResultRows} metricPairs={metricPairs} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: KANALEN — drill-down per kanaal/campagne                 */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'kanalen' && (
          <KanalenTab
            resultRows={resultRows}
            rawRows={rows}
            metricPairs={metricPairs}
            pacing={pacing}
            onChangeRows={setResultRows}
            onChangePacing={setPacing}
          />
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: ANALYSE — zelf samen te stellen grafiek                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'analyse' && (
          <AnalyseTab
            resultRows={resultRows}
            rawRows={rows}
            metricPairs={metricPairs}
            pacing={pacing}
          />
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: SOLLICITATIES — ongewijzigde logica, alleen herstijld    */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'sollicitaties' && (
          <>
            <PeriodBar preset={preset} setPreset={setPreset} customFrom={customFrom} customTo={customTo} setCustomFrom={setCustomFrom} setCustomTo={setCustomTo} />
            <div className="mt-6">
              <SollicitatiesSection
                dateFrom={dateFrom}
                dateTo={dateTo}
                channelSpend={channelSpendFull}
                spendMissing={spendMissing}
              />
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: GA4 — WEBSITE — ongewijzigde logica, alleen herstijld    */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === 'ga4' && (
          <>
            <PeriodBar preset={preset} setPreset={setPreset} customFrom={customFrom} customTo={customTo} setCustomFrom={setCustomFrom} setCustomTo={setCustomTo} />
            <div className="mt-6">
              <AnalyticsSection
                dateFrom={dateFrom}
                dateTo={dateTo}
                liSpend={liTotals.spend}
                meSpend={meTotals.spend}
              />
            </div>
          </>
        )}

      </div>

    </main>
  );
}

// Periode-presets — alleen nodig voor Sollicitaties/GA4 — Website (hun kosten-per-sollicitatie
// en trend-cijfers zijn wél periodegebonden, i.t.t. Totaaloverzicht/Kanalen/Analyse).
function PeriodBar({ preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo }: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="gf-eyebrow mr-1">Periode</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESETS.map(({ key, label }) => {
          const active = preset === key;
          return (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className="text-xs font-semibold px-3 py-1.5"
              style={{
                borderRadius: '5px',
                background: active ? '#1E3A8A' : '#ffffff',
                color: active ? '#ffffff' : '#555E6C',
                border: `1px solid ${active ? '#1E3A8A' : '#DCE0E6'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="text-sm px-2 py-1.5" style={{ border: '1px solid #DCE0E6', borderRadius: '6px' }} />
          <span className="text-sm" style={{ color: '#8C9BAF' }}>t/m</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="text-sm px-2 py-1.5" style={{ border: '1px solid #DCE0E6', borderRadius: '6px' }} />
        </div>
      )}
    </div>
  );
}
