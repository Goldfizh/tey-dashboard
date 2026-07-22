'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { CampaignRow, Platform } from '@/types/campaign';
import { sumRows } from '@/types/campaign';
import type { Objective } from '@/types/objective';
import { autoDetectObjective, OBJECTIVE_LABELS } from '@/types/objective';

// ── types ─────────────────────────────────────────────────────────────────────

type BenchmarkType = 'previous_period' | 'all_others' | 'other_campaigns' | 'none';
type Preset = 'week' | '14days' | 'month' | '3months' | 'custom';

interface MetricRow {
  label:       string;
  focusValue:  string;
  benchValue:  string | null;
  delta:       number | null; // fraction, positive = higher
  lowerBetter: boolean;
}

// ── date helpers ──────────────────────────────────────────────────────────────

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
    const diff = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const mon  = new Date(today); mon.setDate(today.getDate() - diff);
    return { from: fmt(mon), to };
  }
  if (preset === '14days') {
    const s = new Date(today); s.setDate(today.getDate() - 13);
    return { from: fmt(s), to };
  }
  if (preset === 'month') {
    return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  const s = new Date(today); s.setMonth(today.getMonth() - 3);
  return { from: fmt(s), to };
}

function prevPeriod(dateFrom: string, dateTo: string) {
  const fromD = new Date(dateFrom + 'T00:00:00');
  const toD   = new Date(dateTo   + 'T00:00:00');
  const dur   = toD.getTime() - fromD.getTime();
  const pTo   = new Date(fromD.getTime() - 86_400_000);
  const pFrom = new Date(pTo.getTime()   - dur);
  return { prevFrom: fmt(pFrom), prevTo: fmt(pTo) };
}

// ── formatters ────────────────────────────────────────────────────────────────

const fmtEur  = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtEur0 = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum  = (n: number) => n.toLocaleString('nl-NL');
const fmtPct  = (n: number) => `${(n * 100).toFixed(2)}%`;

function deltaFraction(cur: number, prev: number): number | null {
  if (prev === 0 || !isFinite(prev)) return null;
  return (cur - prev) / prev;
}

// ── sub-components ────────────────────────────────────────────────────────────

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5', meta: '#1877F2', google: '#F59E0B',
};
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn', meta: 'Meta', google: 'Google Ads',
};

/** Searchable multi-select campaign picker */
function CampaignPicker({
  allCampaigns,
  selected,
  onChange,
  placeholder,
  exclude,
}: {
  allCampaigns: { name: string; platform: Platform }[];
  selected:     Set<string>;
  onChange:     (next: Set<string>) => void;
  placeholder?: string;
  exclude?:     Set<string>;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const available = allCampaigns.filter(
    (c) => !exclude?.has(c.name) &&
           (query.trim() === '' || c.name.toLowerCase().includes(query.toLowerCase()))
  );

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(next);
  }

  function selectAll() {
    const next = new Set(selected);
    available.forEach((c) => next.add(c.name));
    onChange(next);
  }

  function clearAll() {
    const next = new Set(selected);
    allCampaigns.forEach((c) => next.delete(c.name));
    onChange(next);
  }

  const selectedCount = allCampaigns.filter((c) => selected.has(c.name)).length;

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Zoek op campagnenaam…'}
          className="w-full text-sm px-3 py-2 pr-8 focus:outline-none transition-colors"
          style={{
            border: '1.5px solid #DCE0E6', borderRadius: '8px',
            color: '#0B1020', background: '#F8FAFC',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#1E3A8A')}
          onBlur={(e)  => (e.currentTarget.style.borderColor = '#DCE0E6')}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >✕</button>
        )}
      </div>

      {/* Controls row */}
      {allCampaigns.length > 0 && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: '#8C9BAF' }}>
            <span className="font-semibold" style={{ color: '#0B1020' }}>{selectedCount}</span> geselecteerd
          </span>
          <div className="flex gap-3">
            <button onClick={selectAll}  className="text-xs font-semibold" style={{ color: available.length === 0 ? '#BCC4CF' : '#1E3A8A' }}>Alles</button>
            <span style={{ color: '#DCE0E6', fontSize: 12 }}>|</span>
            <button onClick={clearAll}   className="text-xs font-semibold" style={{ color: selectedCount === 0 ? '#BCC4CF' : '#555E6C' }}>Geen</button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
        {available.length === 0 ? (
          <p className="text-xs py-3 px-1" style={{ color: '#8C9BAF' }}>
            {query ? `Geen campagnes gevonden voor "${query}"` : 'Geen campagnes beschikbaar'}
          </p>
        ) : (
          available.map((c) => {
            const checked = selected.has(c.name);
            return (
              <label
                key={`${c.platform}::${c.name}`}
                className="flex items-start gap-2.5 px-2 py-2 cursor-pointer rounded-md transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F8')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.name)}
                  className="mt-0.5 shrink-0"
                  style={{ width: 14, height: 14, accentColor: PLATFORM_COLOR[c.platform] }}
                />
                <div className="min-w-0">
                  <p className="text-xs leading-snug" style={{ color: checked ? '#0B1020' : '#555E6C', wordBreak: 'break-word' }}>
                    {c.name}
                  </p>
                  <span
                    className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                    style={{
                      background: PLATFORM_COLOR[c.platform],
                      color: c.platform === 'google' ? '#0B1020' : '#fff',
                    }}
                  >
                    {PLATFORM_LABEL[c.platform]}
                  </span>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Delta badge: green = good, red = bad */
function Delta({ value, lowerBetter }: { value: number; lowerBetter: boolean }) {
  const positive = lowerBetter ? value < 0 : value > 0;
  const pct      = `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  const arrow    = value > 0 ? '↑' : '↓';
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded"
      style={{
        color:      positive ? '#16A34A' : '#DC2626',
        background: positive ? '#F0FDF4' : '#FEF2F2',
      }}
    >
      {arrow} {pct}
    </span>
  );
}

/** One metric comparison row */
function MetricCompareRow({ row }: { row: MetricRow }) {
  return (
    <tr style={{ borderBottom: '1px solid #F0F4F8' }} className="last:border-0">
      <td className="px-5 py-3.5 text-xs font-medium" style={{ color: '#555E6C' }}>{row.label}</td>
      <td className="px-5 py-3.5 text-sm font-bold tabular-nums" style={{ color: '#0B1020' }}>{row.focusValue}</td>
      <td className="px-5 py-3.5 text-sm tabular-nums" style={{ color: '#8C9BAF' }}>
        {row.benchValue ?? <span style={{ color: '#DCE0E6' }}>—</span>}
      </td>
      <td className="px-5 py-3.5">
        {row.delta !== null
          ? <Delta value={row.delta} lowerBetter={row.lowerBetter} />
          : <span className="text-xs" style={{ color: '#DCE0E6' }}>—</span>
        }
      </td>
    </tr>
  );
}

// ── main tab ──────────────────────────────────────────────────────────────────

interface Props {
  rows:    CampaignRow[];
  loading: boolean;
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week',    label: 'Deze week' },
  { key: '14days',  label: '14 dagen' },
  { key: 'month',   label: 'Deze maand' },
  { key: '3months', label: '3 maanden' },
  { key: 'custom',  label: 'Aangepast' },
];

const OBJECTIVES: { key: Objective; label: string; icon: string }[] = [
  { key: 'impressies', label: 'Impressies / bereik', icon: '📡' },
  { key: 'verkeer',    label: 'Verkeer',              icon: '🖱️' },
  { key: 'video',      label: 'Videoviews',           icon: '▶️' },
  { key: 'conversies', label: 'Conversies',           icon: '🎯' },
  { key: 'leads',      label: 'Leads',                icon: '📋' },
];

export default function AnalyseTab({ rows, loading }: Props) {
  // ── period ──
  const [preset,     setPreset]     = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  // ── campaigns ──
  const [focusCampaigns,     setFocusCampaigns]     = useState<Set<string>>(new Set());
  const [benchCampaigns,     setBenchCampaigns]     = useState<Set<string>>(new Set());
  const [benchmarkType,      setBenchmarkType]      = useState<BenchmarkType>('previous_period');

  // ── objective ──
  const [manualObjective, setManualObjective] = useState<Objective | null>(null);

  // ── AI summary ──
  const [aiText,    setAiText]    = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { from: dateFrom, to: dateTo } = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  // All unique campaigns across all data
  const allCampaigns = useMemo(() => {
    const seen = new Map<string, Platform>();
    for (const r of rows) seen.set(r.campaign_name, r.platform);
    return Array.from(seen.entries())
      .map(([name, platform]) => ({ name, platform }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Focus rows (date-filtered + campaign-filtered)
  const focusRows = useMemo(() => {
    if (focusCampaigns.size === 0) return [];
    return rows.filter(
      (r) => r.date >= dateFrom && r.date <= dateTo && focusCampaigns.has(r.campaign_name)
    );
  }, [rows, dateFrom, dateTo, focusCampaigns]);

  // Objective auto-detect from focus campaigns
  const autoObjective = useMemo(
    () => autoDetectObjective([...focusCampaigns]),
    [focusCampaigns],
  );
  const objective: Objective = manualObjective ?? autoObjective;

  // Previous period dates
  const { prevFrom, prevTo } = useMemo(
    () => dateFrom && dateTo ? prevPeriod(dateFrom, dateTo) : { prevFrom: '', prevTo: '' },
    [dateFrom, dateTo],
  );

  // Benchmark rows
  const benchRows = useMemo(() => {
    if (benchmarkType === 'none') return [];

    if (benchmarkType === 'previous_period') {
      if (!prevFrom) return [];
      return rows.filter(
        (r) => r.date >= prevFrom && r.date <= prevTo && focusCampaigns.has(r.campaign_name)
      );
    }

    if (benchmarkType === 'all_others') {
      return rows.filter(
        (r) => r.date >= dateFrom && r.date <= dateTo && !focusCampaigns.has(r.campaign_name)
      );
    }

    if (benchmarkType === 'other_campaigns') {
      if (benchCampaigns.size === 0) return [];
      return rows.filter(
        (r) => r.date >= dateFrom && r.date <= dateTo && benchCampaigns.has(r.campaign_name)
      );
    }

    return [];
  }, [rows, benchmarkType, focusCampaigns, benchCampaigns, dateFrom, dateTo, prevFrom, prevTo]);

  // Totals
  const focusTotals = useMemo(() => sumRows(focusRows), [focusRows]);
  const benchTotals = useMemo(() => sumRows(benchRows), [benchRows]);

  const hasFocus = focusCampaigns.size > 0 && focusRows.length > 0;
  const hasBench = benchmarkType !== 'none' && benchRows.length > 0;

  // Computed metrics
  const focusCpa  = focusTotals.conversions > 0 ? focusTotals.spend / focusTotals.conversions : null;
  const focusCpcv = (focusTotals.thruplays ?? 0) > 0 ? focusTotals.spend / (focusTotals.thruplays ?? 0) : null;
  const focusCpm  = focusTotals.impressions > 0 ? focusTotals.spend / focusTotals.impressions * 1000 : null;
  const focusCpc  = focusTotals.clicks > 0 ? focusTotals.spend / focusTotals.clicks : null;
  const focusCtr  = focusTotals.impressions > 0 ? focusTotals.clicks / focusTotals.impressions : 0;
  const focusVtr  = focusTotals.impressions > 0 ? (focusTotals.thruplays ?? 0) / focusTotals.impressions : 0;

  const benchCpa  = benchTotals.conversions > 0 ? benchTotals.spend / benchTotals.conversions : null;
  const benchCpcv = (benchTotals.thruplays ?? 0) > 0 ? benchTotals.spend / (benchTotals.thruplays ?? 0) : null;
  const benchCpm  = benchTotals.impressions > 0 ? benchTotals.spend / benchTotals.impressions * 1000 : null;
  const benchCpc  = benchTotals.clicks > 0 ? benchTotals.spend / benchTotals.clicks : null;
  const benchCtr  = benchTotals.impressions > 0 ? benchTotals.clicks / benchTotals.impressions : 0;
  const benchVtr  = benchTotals.impressions > 0 ? (benchTotals.thruplays ?? 0) / benchTotals.impressions : 0;

  // Build metric rows for comparison table
  const metricRows = useMemo((): MetricRow[] => {
    if (!hasFocus) return [];

    const b = hasBench;
    const isVideo = objective === 'video';
    const isReach = objective === 'impressies' || objective === 'verkeer';
    const isLeads = objective === 'leads';

    const rows: MetricRow[] = [
      {
        label: 'Budget gespendeerd',
        focusValue: fmtEur0(focusTotals.spend),
        benchValue: b ? fmtEur0(benchTotals.spend) : null,
        delta:      b ? deltaFraction(focusTotals.spend, benchTotals.spend) : null,
        lowerBetter: false,
      },
      {
        label: 'Impressies',
        focusValue: fmtNum(focusTotals.impressions),
        benchValue: b ? fmtNum(benchTotals.impressions) : null,
        delta:      b ? deltaFraction(focusTotals.impressions, benchTotals.impressions) : null,
        lowerBetter: false,
      },
    ];

    if (isVideo) {
      rows.push(
        {
          label: 'Completed views',
          focusValue: focusTotals.thruplays > 0 ? fmtNum(focusTotals.thruplays) : '—',
          benchValue: b ? (benchTotals.thruplays > 0 ? fmtNum(benchTotals.thruplays) : '—') : null,
          delta:      b && focusTotals.thruplays > 0 ? deltaFraction(focusTotals.thruplays, benchTotals.thruplays) : null,
          lowerBetter: false,
        },
        {
          label: 'VTR',
          focusValue: focusVtr > 0 ? fmtPct(focusVtr) : '—',
          benchValue: b ? (benchVtr > 0 ? fmtPct(benchVtr) : '—') : null,
          delta:      b && focusVtr > 0 && benchVtr > 0 ? deltaFraction(focusVtr, benchVtr) : null,
          lowerBetter: false,
        },
        {
          label: 'CPCV (kosten per video view)',
          focusValue: focusCpcv !== null ? fmtEur(focusCpcv) : '—',
          benchValue: b ? (benchCpcv !== null ? fmtEur(benchCpcv) : '—') : null,
          delta:      b && focusCpcv !== null && benchCpcv !== null ? deltaFraction(focusCpcv, benchCpcv) : null,
          lowerBetter: true,
        },
      );
    } else {
      rows.push(
        {
          label: 'Clicks',
          focusValue: fmtNum(focusTotals.clicks),
          benchValue: b ? fmtNum(benchTotals.clicks) : null,
          delta:      b ? deltaFraction(focusTotals.clicks, benchTotals.clicks) : null,
          lowerBetter: false,
        },
        {
          label: 'CTR',
          focusValue: fmtPct(focusCtr),
          benchValue: b ? fmtPct(benchCtr) : null,
          delta:      b && benchCtr > 0 ? deltaFraction(focusCtr, benchCtr) : null,
          lowerBetter: false,
        },
        {
          label: 'CPC (kosten per klik)',
          focusValue: focusCpc !== null ? fmtEur(focusCpc) : '—',
          benchValue: b ? (benchCpc !== null ? fmtEur(benchCpc) : '—') : null,
          delta:      b && focusCpc !== null && benchCpc !== null ? deltaFraction(focusCpc, benchCpc) : null,
          lowerBetter: true,
        },
      );

      if (isReach) {
        rows.push({
          label: 'CPM (kosten per 1000 impressies)',
          focusValue: focusCpm !== null ? fmtEur(focusCpm) : '—',
          benchValue: b ? (benchCpm !== null ? fmtEur(benchCpm) : '—') : null,
          delta:      b && focusCpm !== null && benchCpm !== null ? deltaFraction(focusCpm, benchCpm) : null,
          lowerBetter: true,
        });
      } else {
        rows.push(
          {
            label: isLeads ? 'Leads' : 'Sollicitanten',
            focusValue: fmtNum(focusTotals.conversions),
            benchValue: b ? fmtNum(benchTotals.conversions) : null,
            delta:      b ? deltaFraction(focusTotals.conversions, benchTotals.conversions) : null,
            lowerBetter: false,
          },
          {
            label: isLeads ? 'CPL (kosten per lead)' : 'CPA (kosten per sollicitant)',
            focusValue: focusCpa !== null ? fmtEur(focusCpa) : '—',
            benchValue: b ? (benchCpa !== null ? fmtEur(benchCpa) : '—') : null,
            delta:      b && focusCpa !== null && benchCpa !== null ? deltaFraction(focusCpa, benchCpa) : null,
            lowerBetter: true,
          },
        );
      }
    }

    return rows;
  }, [
    hasFocus, hasBench, objective,
    focusTotals, benchTotals,
    focusCpa, focusCpcv, focusCpm, focusCpc, focusCtr, focusVtr,
    benchCpa, benchCpcv, benchCpm, benchCpc, benchCtr, benchVtr,
  ]);

  // ── AI summary ────────────────────────────────────────────────────────────

  async function generateSummary() {
    if (!hasFocus || metricRows.length === 0) return;
    setAiText('');
    setAiLoading(true);

    const benchLabel =
      benchmarkType === 'previous_period'  ? `vorige periode (${prevFrom} – ${prevTo})`
      : benchmarkType === 'all_others'     ? 'gemiddelde van alle overige campagnes'
      : benchmarkType === 'other_campaigns'? 'geselecteerde benchmarkcampagnes'
      :                                      'geen benchmark';

    const focusList  = [...focusCampaigns].join(', ');
    const metricsStr = metricRows.map((r) =>
      `- ${r.label}: focus = ${r.focusValue}${r.benchValue ? `, benchmark = ${r.benchValue}` : ''}${r.delta !== null ? `, delta = ${(r.delta * 100).toFixed(1)}%` : ''}`
    ).join('\n');

    const prompt = `Analyseer de volgende advertentieresultaten voor een Nederlandse recruitment marketing manager.

Focuscampagnes: ${focusList}
Periode: ${dateFrom} t/m ${dateTo}
Doelstelling: ${OBJECTIVE_LABELS[objective]}
Benchmark: ${benchLabel}

Metrics:
${metricsStr}

Schrijf een heldere, zakelijke analyse in het Nederlands (max 200 woorden):
1. Hoe presteren de focuscampagnes in deze periode?
2. Hoe verhoudt dit zich tot de benchmark? (Als er een benchmark is)
3. Wat zijn de 1-2 belangrijkste aandachtspunten of kansen?

Gebruik geen bulletpoints — schrijf lopende tekst in 2-3 alinea's.`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (!res.ok || !res.body) throw new Error('AI niet beschikbaar');

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let text     = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:"')) {
            try {
              const raw = line.slice(2); // remove `0:`
              text += JSON.parse(raw);
              setAiText(text);
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      setAiText('Er ging iets mis bij het genereren van de samenvatting. Probeer het opnieuw.');
    } finally {
      setAiLoading(false);
    }
  }

  // Reset AI text when config changes
  useEffect(() => { setAiText(''); }, [focusCampaigns, benchmarkType, benchCampaigns, preset, objective]);

  // ── benchmark label ───────────────────────────────────────────────────────

  const benchmarkLabel =
    benchmarkType === 'previous_period'   ? `Vorige periode (${prevFrom} – ${prevTo})`
    : benchmarkType === 'all_others'      ? 'Alle overige campagnes'
    : benchmarkType === 'other_campaigns' ? 'Andere campagnes'
    :                                       null;

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-sm" style={{ color: '#8C9BAF' }}>
        <svg className="animate-spin mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Data laden…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

      {/* ── Left config panel ─────────────────────────────────────────── */}
      <aside
        className="bg-white shrink-0"
        style={{
          width: '280px',
          border: '1px solid #DCE0E6',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(18,16,34,0.06)',
          position: 'sticky',
          top: '120px',
          maxHeight: 'calc(100vh - 140px)',
          overflowY: 'auto',
        }}
      >
        <div className="p-4 space-y-6">

          {/* Periode */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8C9BAF' }}>
              Periode
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className="text-xs font-semibold px-2.5 py-1 transition-all"
                  style={{
                    borderRadius: '4px',
                    background: preset === key ? '#1E3A8A' : '#F0F4F8',
                    color:      preset === key ? '#fff'    : '#555E6C',
                    border:     `1px solid ${preset === key ? '#1E3A8A' : 'transparent'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex flex-col gap-1.5">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs px-2 py-1.5 focus:outline-none" style={{ border: '1px solid #DCE0E6', borderRadius: '5px' }} />
                <input type="date" value={customTo}   onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs px-2 py-1.5 focus:outline-none" style={{ border: '1px solid #DCE0E6', borderRadius: '5px' }} />
              </div>
            )}
            {preset !== 'custom' && dateFrom && (
              <p className="text-xs mt-1" style={{ color: '#BCC4CF' }}>
                {new Date(dateFrom + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(dateTo + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #F0F4F8' }} />

          {/* Focus campagnes */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8C9BAF' }}>
              Focus campagnes
            </p>
            <CampaignPicker
              allCampaigns={allCampaigns}
              selected={focusCampaigns}
              onChange={setFocusCampaigns}
              exclude={benchCampaigns}
              placeholder="Zoek campagne…"
            />
          </div>

          <div style={{ borderTop: '1px solid #F0F4F8' }} />

          {/* Benchmark */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8C9BAF' }}>
              Benchmark
            </p>
            <div className="flex flex-col gap-1.5 mb-3">
              {([
                { key: 'previous_period',  label: 'Vorige periode',        icon: '⏮' },
                { key: 'all_others',       label: 'Alle overige campagnes', icon: '⚖️' },
                { key: 'other_campaigns',  label: 'Andere campagnes',       icon: '🔀' },
                { key: 'none',             label: 'Geen benchmark',         icon: '—' },
              ] as { key: BenchmarkType; label: string; icon: string }[]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setBenchmarkType(key)}
                  className="flex items-center gap-2 px-3 py-2 text-left transition-all"
                  style={{
                    borderRadius: '6px',
                    border:      `1px solid ${benchmarkType === key ? '#1E3A8A' : 'transparent'}`,
                    background:  benchmarkType === key ? '#1E3A8A14' : 'transparent',
                    color:       benchmarkType === key ? '#1E3A8A'   : '#555E6C',
                  }}
                  onMouseEnter={(e) => { if (benchmarkType !== key) e.currentTarget.style.background = '#F0F4F8'; }}
                  onMouseLeave={(e) => { if (benchmarkType !== key) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="text-sm">{icon}</span>
                  <span className="text-xs font-semibold">{label}</span>
                  {benchmarkType === key && <span className="ml-auto text-[10px] bg-[#1E3A8A] text-white rounded px-1 py-0.5">actief</span>}
                </button>
              ))}
            </div>

            {benchmarkType === 'other_campaigns' && (
              <div className="mt-2">
                <p className="text-xs font-semibold mb-2" style={{ color: '#555E6C' }}>Kies benchmarkcampagnes:</p>
                <CampaignPicker
                  allCampaigns={allCampaigns}
                  selected={benchCampaigns}
                  onChange={setBenchCampaigns}
                  exclude={focusCampaigns}
                  placeholder="Zoek benchmark campagne…"
                />
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #F0F4F8' }} />

          {/* Doelstelling */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8C9BAF' }}>
              Doelstelling
            </p>
            {/* Auto-detected */}
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md" style={{ background: '#F0F4F8' }}>
              <span className="text-[10px]" style={{ color: '#8C9BAF' }}>Auto:</span>
              <span className="text-xs font-semibold" style={{ color: '#1E3A8A' }}>
                {OBJECTIVE_LABELS[autoObjective]}
              </span>
              {manualObjective && (
                <button onClick={() => setManualObjective(null)} className="ml-auto text-[10px]" style={{ color: '#BCC4CF' }} title="Reset naar automatisch">✕</button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {OBJECTIVES.map(({ key, label, icon }) => {
                const active = objective === key;
                const isManual = manualObjective === key;
                return (
                  <button
                    key={key}
                    onClick={() => setManualObjective(isManual ? null : key)}
                    className="flex items-center gap-2 px-2 py-1.5 text-left transition-all"
                    style={{
                      borderRadius: '5px',
                      border:      `1px solid ${active ? '#1E3A8A' : 'transparent'}`,
                      background:  active ? '#1E3A8A10' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F0F4F8'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span className="text-xs">{icon}</span>
                    <span className="text-xs font-medium" style={{ color: active ? '#1E3A8A' : '#555E6C' }}>{label}</span>
                    {isManual && <span className="ml-auto text-[10px] bg-[#1E3A8A] text-white rounded px-1">handmatig</span>}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </aside>

      {/* ── Right content area ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">

        {/* Empty state */}
        {focusCampaigns.size === 0 && (
          <div
            className="bg-white flex flex-col items-center justify-center py-24 text-center"
            style={{ border: '1px solid #DCE0E6', borderRadius: '10px', boxShadow: '0 4px 16px rgba(18,16,34,0.06)' }}
          >
            <span className="text-5xl mb-4">📊</span>
            <p className="text-lg font-semibold mb-1" style={{ color: '#0B1020' }}>Kies je focuscampagnes</p>
            <p className="text-sm max-w-sm" style={{ color: '#8C9BAF' }}>
              Selecteer een of meer campagnes in het linkerpaneel om de resultaten te bekijken en te vergelijken met een benchmark.
            </p>
          </div>
        )}

        {/* No data in period */}
        {focusCampaigns.size > 0 && focusRows.length === 0 && (
          <div
            className="bg-white flex flex-col items-center justify-center py-16 text-center"
            style={{ border: '1px solid #DCE0E6', borderRadius: '10px' }}
          >
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-semibold mb-1" style={{ color: '#0B1020' }}>Geen data in deze periode</p>
            <p className="text-xs" style={{ color: '#8C9BAF' }}>
              De geselecteerde campagnes hebben geen data in {dateFrom} – {dateTo}. Probeer een andere periode.
            </p>
          </div>
        )}

        {/* Results */}
        {hasFocus && (
          <>
            {/* Header */}
            <div
              className="bg-white px-6 py-4 flex items-start justify-between gap-4 flex-wrap"
              style={{ border: '1px solid #DCE0E6', borderRadius: '10px', boxShadow: '0 4px 16px rgba(18,16,34,0.06)' }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#1E3A8A' }}>
                  {OBJECTIVE_LABELS[objective]} · {focusCampaigns.size} campagne{focusCampaigns.size !== 1 ? 's' : ''}
                  {manualObjective && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">handmatig</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...focusCampaigns].map((name) => {
                    const platform = allCampaigns.find((c) => c.name === name)?.platform ?? 'linkedin';
                    return (
                      <span
                        key={name}
                        className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                        style={{ background: `${PLATFORM_COLOR[platform]}18`, color: PLATFORM_COLOR[platform], border: `1px solid ${PLATFORM_COLOR[platform]}40` }}
                      >
                        {name}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs" style={{ color: '#8C9BAF' }}>
                  {new Date(dateFrom + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {new Date(dateTo + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {benchmarkLabel && (
                  <p className="text-xs font-semibold mt-0.5" style={{ color: '#555E6C' }}>
                    vs. {benchmarkLabel}
                  </p>
                )}
              </div>
            </div>

            {/* Comparison table */}
            <div
              className="bg-white overflow-hidden"
              style={{ border: '1px solid #DCE0E6', borderRadius: '10px', boxShadow: '0 4px 16px rgba(18,16,34,0.06)' }}
            >
              <table className="w-full">
                <thead style={{ background: '#F0F4F8', borderBottom: '1px solid #DCE0E6' }}>
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Metric</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#1E3A8A' }}>Focus</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>
                      {hasBench ? benchmarkLabel ?? 'Benchmark' : 'Benchmark'}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Verschil</th>
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map((row) => (
                    <MetricCompareRow key={row.label} row={row} />
                  ))}
                  {!hasBench && (
                    <tr>
                      <td colSpan={4} className="px-5 py-4 text-xs text-center" style={{ color: '#BCC4CF' }}>
                        Selecteer een benchmark in het linkerpaneel om te vergelijken
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* AI summary */}
            <div
              className="bg-white px-6 py-5"
              style={{ border: '1px solid #DCE0E6', borderRadius: '10px', boxShadow: '0 4px 16px rgba(18,16,34,0.06)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8C9BAF' }}>
                  AI-analyse
                </p>
                <button
                  onClick={generateSummary}
                  disabled={aiLoading}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                  style={{ background: '#1E3A8A', color: '#fff' }}
                  onMouseEnter={(e) => { if (!aiLoading) e.currentTarget.style.background = '#16295E'; }}
                  onMouseLeave={(e) => { if (!aiLoading) e.currentTarget.style.background = '#1E3A8A'; }}
                >
                  {aiLoading ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Analyseren…
                    </>
                  ) : (
                    <>✨ {aiText ? 'Opnieuw analyseren' : 'Analyseer resultaten'}</>
                  )}
                </button>
              </div>

              {!aiText && !aiLoading && (
                <p className="text-sm" style={{ color: '#BCC4CF' }}>
                  Klik op &ldquo;Analyseer resultaten&rdquo; voor een AI-samenvatting van de vergelijking.
                </p>
              )}

              {(aiText || aiLoading) && (
                <div className="prose prose-sm max-w-none" style={{ color: '#0B1020', lineHeight: '1.7' }}>
                  <ReactMarkdown>{aiText || '…'}</ReactMarkdown>
                  {aiLoading && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse rounded-sm" style={{ background: '#1E3A8A' }} />
                  )}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
