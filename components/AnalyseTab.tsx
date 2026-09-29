'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChannelResultRow, MetricPairDef, Pacing } from '@/types/results';
import type { GroupBy, GroupedEntity } from '@/lib/channelDrilldown';
import { buildMetricOptions, UNIT_FORMATTERS } from '@/lib/metricOptions';
import type { CampaignRow } from '@/types/campaign';
import { buildDailyEntities, groupByCampagne, groupByKanaal } from '@/lib/resultsAdapter';

interface Props {
  resultRows: ChannelResultRow[]; // alle campagnes, alle actieve kanalen
  rawRows: CampaignRow[]; // ruwe (dag-niveau) rijen, ongefilterd — periode/kanaal/campagne filtert dit component zelf
  metricPairs: MetricPairDef[];
  pacing: Pacing;
}

// Geen Doelgroep/Advertentie-niveau: de brondata (Google Sheets-export per campagne per dag)
// kent geen ad-groep/creative-granulariteit, dus dat blijft beperkt tot Dag/Campagne/Kanaal.
const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'dag', label: 'Dag' },
  { key: 'campagne', label: 'Campagne' },
  { key: 'kanaal', label: 'Kanaal' },
];

const MAX_CATEGORIES = 30;
const SECONDARY_COLOR = '#0F9B8E'; // teal — secundaire lijnkleur naast het donkerblauwe merk

function shortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

const selectStyle: CSSProperties = {
  border: '1px solid #DCE0E6', borderRadius: '6px', color: '#22222D', background: '#ffffff',
};

// Zelf samen te stellen grafiek: kies eerst de periode (bepaalt alles hieronder), dan
// kanaal/campagne, waarop je groepeert (X-as) en twee metrics — de eerste als lijn, de tweede
// als balken, elk op hun eigen y-as omdat eenheden (€, aantal, %) sterk uiteen kunnen lopen.
export default function AnalyseTab({ resultRows, rawRows, metricPairs, pacing }: Props) {
  const [rangeStart, setRangeStart] = useState(pacing.startDate);
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedKanaal, setSelectedKanaal] = useState('');
  const [selectedCampagne, setSelectedCampagne] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('dag');

  const kanalen = useMemo(() => [...new Set(resultRows.map((r) => r.kanaal))].sort(), [resultRows]);
  const metricOptions = useMemo(() => buildMetricOptions(metricPairs), [metricPairs]);
  const [metric1Key, setMetric1Key] = useState('spend');
  const [metric2Key, setMetric2Key] = useState('impressions');

  const campagnes = useMemo(() =>
    [...new Set(resultRows.filter((r) => !selectedKanaal || r.kanaal === selectedKanaal).map((r) => r.campagne))].sort(),
    [resultRows, selectedKanaal],
  );

  function changeKanaal(k: string) {
    setSelectedKanaal(k);
    setSelectedCampagne('');
  }

  // Alle filtering (periode, kanaal, campagne) gebeurt hier client-side op de al geladen
  // ruwe rijen — geen aparte netwerk-aanroep per periode nodig.
  const filteredRawRows = useMemo(() =>
    rawRows.filter((r) =>
      (!rangeStart || r.date >= rangeStart) &&
      (!rangeEnd || r.date <= rangeEnd) &&
      (!selectedKanaal || resultRows.some((rr) => rr.kanaal === selectedKanaal && rr.campagne === r.campaign_name)) &&
      (!selectedCampagne || r.campaign_name === selectedCampagne),
    ),
    [rawRows, rangeStart, rangeEnd, selectedKanaal, selectedCampagne, resultRows],
  );

  const entities: GroupedEntity[] = useMemo(() => {
    if (groupBy === 'kanaal') return groupByKanaal(filteredRawRows);
    if (groupBy === 'campagne') return groupByCampagne(filteredRawRows);
    return buildDailyEntities(filteredRawRows).map((d) => ({ label: d.date, metrics: d.metrics }));
  }, [groupBy, filteredRawRows]);

  const metric1 = metricOptions.find((o) => o.key === metric1Key) ?? metricOptions[0];
  const metric2 = metric2Key ? metricOptions.find((o) => o.key === metric2Key) ?? null : null;

  // Voor "Dag" is de volgorde de tijdlijn zelf — daar sorteren op waarde zou de grafiek juist
  // onleesbaar maken. Bij te veel dagen tonen we de meest recente periode (nog steeds
  // chronologisch); bij categorische groeperingen (campagne/kanaal) sorteren we op Metric 1 en
  // tonen we de top N.
  const truncated = entities.length > MAX_CATEGORIES;
  const sortedEntities = !truncated
    ? entities
    : groupBy === 'dag'
      ? entities.slice(-MAX_CATEGORIES)
      : [...entities].sort((a, b) => (metric1.getValue(b.metrics) ?? 0) - (metric1.getValue(a.metrics) ?? 0)).slice(0, MAX_CATEGORIES);

  const chartData = sortedEntities.map((e) => ({
    label: groupBy === 'dag' ? shortDate(e.label) : e.label,
    metric1: metric1.getValue(e.metrics),
    metric2: metric2 ? metric2.getValue(e.metrics) : undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Periode — als eerste, bepaalt de data voor elke groepering hieronder */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="gf-eyebrow">Periode</p>
        <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="text-sm px-3 py-2" style={selectStyle} />
        <span className="text-sm" style={{ color: '#8C9BAF' }}>t/m</span>
        <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="text-sm px-3 py-2" style={selectStyle} />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="gf-eyebrow mb-2">Kanaal</p>
          <select value={selectedKanaal} onChange={(e) => changeKanaal(e.target.value)} className="text-sm font-semibold px-3 py-2" style={selectStyle}>
            <option value="">Alle kanalen</option>
            {kanalen.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <p className="gf-eyebrow mb-2">Campagne</p>
          <select value={selectedCampagne} onChange={(e) => setSelectedCampagne(e.target.value)} className="text-sm font-semibold px-3 py-2" style={selectStyle}>
            <option value="">Alle campagnes</option>
            {campagnes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <p className="gf-eyebrow mb-2">Groeperen op (X-as)</p>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="text-sm font-semibold px-3 py-2" style={selectStyle}>
            {GROUP_OPTIONS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <p className="gf-eyebrow mb-2">Metric 1 — lijn</p>
          <select value={metric1Key} onChange={(e) => setMetric1Key(e.target.value)} className="text-sm font-semibold px-3 py-2" style={{ ...selectStyle, color: '#1E3A8A' }}>
            {metricOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <p className="gf-eyebrow mb-2">Metric 2 — balken</p>
          <select value={metric2Key} onChange={(e) => setMetric2Key(e.target.value)} className="text-sm font-semibold px-3 py-2" style={{ ...selectStyle, color: SECONDARY_COLOR }}>
            <option value="">Geen</option>
            {metricOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {truncated && (
        <p className="text-xs" style={{ color: '#8C9BAF' }}>
          {groupBy === 'dag'
            ? `${entities.length} dagen gevonden — meest recente ${MAX_CATEGORIES} getoond.`
            : `${entities.length} categorieën gevonden — top ${MAX_CATEGORIES} getoond, gesorteerd op ${metric1.label}.`}
        </p>
      )}

      <div className="bg-white" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)', padding: '20px' }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height: '360px' }}>
            <p className="text-sm" style={{ color: '#8C9BAF' }}>Geen data voor deze selectie</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C9BAF' }} axisLine={{ stroke: '#DCE0E6' }} tickLine={false} interval={0} angle={chartData.length > 8 ? -35 : 0} textAnchor={chartData.length > 8 ? 'end' : 'middle'} height={chartData.length > 8 ? 70 : 30} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#1E3A8A' }} axisLine={false} tickLine={false} tickFormatter={(v) => UNIT_FORMATTERS[metric1.unit](v)} width={70} />
              {metric2 && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: SECONDARY_COLOR }} axisLine={false} tickLine={false} tickFormatter={(v) => UNIT_FORMATTERS[metric2.unit](v)} width={70} />
              )}
              <Tooltip
                formatter={(value, _name, item) => {
                  const opt = item.dataKey === 'metric2' ? metric2 : metric1;
                  const num = typeof value === 'number' ? value : Number(value);
                  return [opt && !Number.isNaN(num) ? UNIT_FORMATTERS[opt.unit](num) : String(value ?? ''), opt?.label ?? ''];
                }}
                labelStyle={{ color: '#22222D', fontWeight: 600 }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E6' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {metric2 && (
                <Bar yAxisId="right" dataKey="metric2" name={metric2.label} fill={`${SECONDARY_COLOR}33`} stroke={SECONDARY_COLOR} radius={[3, 3, 0, 0]} />
              )}
              <Line yAxisId="left" type="monotone" dataKey="metric1" name={metric1.label} stroke="#1E3A8A" strokeWidth={2} dot={chartData.length <= 40} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
