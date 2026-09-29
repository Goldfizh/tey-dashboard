'use client';

import type { ChannelResultRow, MetricPairDef } from '@/types/results';
import { BASE_METRIC, awarenessFromVolumes, costFor, kpiToSpendVolumes, ratio, sumSpendVolumes } from '@/types/results';
import { fmtDecimal, fmtEur, fmtNum, fmtPct } from '@/lib/format';

interface Props {
  rows: ChannelResultRow[];
  metricPairs: MetricPairDef[]; // unie van de per-campagne actieve doel-bundels
}

function fmtOrDash(v: number | null, fmt: (n: number) => string) {
  return v === null ? '—' : fmt(v);
}

function pctKpi(achieved: number | null, kpi: number | null): number | null {
  if (achieved === null || kpi === null || kpi === 0) return null;
  return achieved / kpi;
}

export default function TotalsResultsTable({ rows, metricPairs }: Props) {
  const achievedSum = sumSpendVolumes(rows.map((r) => r.achieved));
  // KPI-rijen leveren kosten-targets, geen volumes — eerst per rij omzetten naar
  // volumes (budget ÷ kosten-target, bereik via frequentie), dan pas optellen.
  const kpiSum = sumSpendVolumes(rows.map((r) => kpiToSpendVolumes(r.kpi, [BASE_METRIC, ...metricPairs])));
  const aAchieved = awarenessFromVolumes(achievedSum);
  const aKpi = awarenessFromVolumes(kpiSum); // zelfde afleiding: spend/impressies → CPM, impressies/bereik → frequentie

  // % KPI is alleen zinvol voor volume-/spend-achtige metrics ("hoeveel van je
  // target heb je al bereikt") — niet voor kosten-per-x (CPM/CPC/CPCV/CPA) of
  // ratio's (CTR/VTR/Conversie%) en Frequentie: een lagere CPC dan target is
  // juist gunstig, dus "% KPI" daarop zou verwarrend zijn i.p.v. behulpzaam.
  const metricRows: { label: string; achieved: number | null; kpi: number | null; fmt: (n: number) => string; showPct: boolean }[] = [
    { label: 'Budget', achieved: achievedSum.spend, kpi: kpiSum.spend, fmt: fmtEur, showPct: true },
    { label: 'Impressies', achieved: aAchieved.impressions, kpi: aKpi.impressions, fmt: fmtNum, showPct: true },
    { label: 'Bereik', achieved: aAchieved.reach, kpi: aKpi.reach, fmt: fmtNum, showPct: true },
    { label: 'Frequentie', achieved: aAchieved.frequency, kpi: aKpi.frequency, fmt: fmtDecimal, showPct: false },
    { label: 'CPM', achieved: aAchieved.cpm, kpi: aKpi.cpm, fmt: fmtEur, showPct: false },
  ];
  for (const p of metricPairs) {
    metricRows.push({ label: p.costLabel, achieved: costFor(achievedSum, p), kpi: costFor(kpiSum, p), fmt: fmtEur, showPct: false });
    metricRows.push({ label: p.volumeLabel, achieved: achievedSum.volumes[p.key] ?? 0, kpi: kpiSum.volumes[p.key] ?? 0, fmt: fmtNum, showPct: true });
    if (p.rateLabel) {
      metricRows.push({
        label: p.rateLabel,
        achieved: ratio(achievedSum, p.key, 'impressions'),
        kpi: ratio(kpiSum, p.key, 'impressions'),
        fmt: fmtPct,
        showPct: false,
      });
    }
  }

  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="px-4 py-3" style={{ background: '#1E3A8A' }}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">Totaalresultaten</span>
      </div>
      <table className="w-full">
        <thead style={{ background: '#F0F4F8', borderBottom: '1px solid #DCE0E6' }}>
          <tr>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Metric</th>
            <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Achieved</th>
            <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>KPI</th>
            <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>% KPI</th>
          </tr>
        </thead>
        <tbody>
          {metricRows.map(({ label, achieved, kpi, fmt, showPct }, i) => {
            const pct = showPct ? pctKpi(achieved, kpi) : null;
            return (
              <tr key={`${label}-${i}`} style={{ borderBottom: '1px solid #F0F4F8' }} className="last:border-0">
                <td className="py-2.5 px-4 text-xs font-medium" style={{ color: '#555E6C' }}>{label}</td>
                <td className="py-2.5 px-4 text-right text-sm tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtOrDash(achieved, fmt)}</td>
                <td className="py-2.5 px-4 text-right text-sm tabular-nums" style={{ color: '#555E6C' }}>{fmtOrDash(kpi, fmt)}</td>
                <td className="py-2.5 px-4 text-right text-sm tabular-nums font-semibold" style={{ color: pct !== null && pct >= 1 ? '#16A34A' : '#22222D' }}>{showPct ? (pct !== null ? fmtPct(pct) : '—') : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
