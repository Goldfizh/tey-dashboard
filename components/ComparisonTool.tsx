'use client';

import { useMemo, useState } from 'react';
import KpiCard from '@/components/KpiCard';
import { awarenessFromVolumes, costFor, ratio, sumSpendVolumes } from '@/types/results';
import type { MetricPairDef, SpendVolumes } from '@/types/results';
import type { DailyEntity } from '@/lib/channelDrilldown';
import { PERIOD_PRESETS, presetRange, previousPeriod } from '@/lib/dateHelpers';
import type { Preset } from '@/lib/dateHelpers';
import { fmtDecimal, fmtEur, fmtNum, fmtPct } from '@/lib/format';

interface Props {
  dailyEntities: DailyEntity[]; // som van de dagcijfers over alle geselecteerde advertenties
  metricPairs: MetricPairDef[];
}

function delta(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return (cur - prev) / prev;
}

function sumRange(entities: DailyEntity[], from: string, to: string): SpendVolumes {
  return sumSpendVolumes(entities.filter((e) => e.date >= from && e.date <= to).map((e) => e.metrics));
}

function fmtOrDash(v: number | null, fmt: (n: number) => string) {
  return v === null ? '—' : fmt(v);
}

// Periode-vergelijkingstool — zelfde presets/toggle als eerder bij "Advertenties",
// maar nu vergelijk je de huidige periode met de vórige periode (i.p.v. met de KPI).
export default function ComparisonTool({ dailyEntities, metricPairs }: Props) {
  const [preset, setPreset] = useState<Preset>('3months');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compareEnabled, setCompareEnabled] = useState(true);

  const { from, to } = useMemo(() => presetRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { prevFrom, prevTo } = useMemo(() => previousPeriod(from, to), [from, to]);

  const current = useMemo(() => sumRange(dailyEntities, from, to), [dailyEntities, from, to]);
  const previous = useMemo(() => sumRange(dailyEntities, prevFrom, prevTo), [dailyEntities, prevFrom, prevTo]);

  const curAwareness = awarenessFromVolumes(current);
  const prevAwareness = awarenessFromVolumes(previous);

  const cards: { title: string; value: string; sub: string; d: number | null; inverted: boolean }[] = [
    { title: 'Budget', value: fmtEur(current.spend), sub: 'Uitgegeven', d: compareEnabled ? delta(current.spend, previous.spend) : null, inverted: false },
    { title: 'Impressies', value: fmtNum(curAwareness.impressions), sub: 'Bekendheid', d: compareEnabled ? delta(curAwareness.impressions, prevAwareness.impressions) : null, inverted: false },
    { title: 'Bereik', value: fmtNum(curAwareness.reach), sub: 'Bekendheid', d: compareEnabled ? delta(curAwareness.reach, prevAwareness.reach) : null, inverted: false },
    { title: 'Frequentie', value: fmtOrDash(curAwareness.frequency, fmtDecimal), sub: 'Bekendheid', d: compareEnabled && curAwareness.frequency !== null && prevAwareness.frequency !== null ? delta(curAwareness.frequency, prevAwareness.frequency) : null, inverted: false },
    { title: 'CPM', value: fmtOrDash(curAwareness.cpm, fmtEur), sub: 'Bekendheid', d: compareEnabled && curAwareness.cpm !== null && prevAwareness.cpm !== null ? delta(curAwareness.cpm, prevAwareness.cpm) : null, inverted: true },
  ];
  for (const p of metricPairs) {
    const curCost = costFor(current, p);
    const prevCost = costFor(previous, p);
    const curVol = current.volumes[p.key] ?? 0;
    const prevVol = previous.volumes[p.key] ?? 0;
    cards.push({ title: p.volumeLabel, value: fmtNum(curVol), sub: p.costLabel, d: compareEnabled ? delta(curVol, prevVol) : null, inverted: false });
    cards.push({ title: p.costLabel, value: curCost !== null ? fmtEur(curCost) : '—', sub: p.volumeLabel, d: compareEnabled && curCost !== null && prevCost !== null ? delta(curCost, prevCost) : null, inverted: true });
    if (p.rateLabel) {
      const curRate = ratio(current, p.key, 'impressions');
      const prevRate = ratio(previous, p.key, 'impressions');
      cards.push({ title: p.rateLabel, value: curRate !== null ? fmtPct(curRate) : '—', sub: p.volumeLabel, d: compareEnabled && curRate !== null && prevRate !== null ? delta(curRate, prevRate) : null, inverted: false });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="gf-eyebrow mr-1">Periode</span>
        {PERIOD_PRESETS.map(({ key, label }) => {
          const active = preset === key;
          return (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className="text-xs font-semibold px-3 py-1.5 transition-all"
              style={{
                borderRadius: '4px',
                background: active ? '#1E3A8A' : '#ffffff',
                color: active ? '#ffffff' : '#555E6C',
                border: `1px solid ${active ? '#1E3A8A' : '#DCE0E6'}`,
              }}
            >
              {label}
            </button>
          );
        })}

        {preset === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs px-2.5 py-1.5" style={{ border: '1px solid #DCE0E6', borderRadius: '4px', color: '#22222D' }} />
            <span className="text-xs" style={{ color: '#8C9BAF' }}>t/m</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs px-2.5 py-1.5" style={{ border: '1px solid #DCE0E6', borderRadius: '4px', color: '#22222D' }} />
          </div>
        )}

        <button
          onClick={() => setCompareEnabled((c) => !c)}
          className="text-xs font-semibold px-3 py-1.5 transition-all"
          style={{
            borderRadius: '4px',
            background: compareEnabled ? '#1E3A8A14' : '#ffffff',
            color: compareEnabled ? '#1E3A8A' : '#555E6C',
            border: `1px solid ${compareEnabled ? '#1E3A8A' : '#DCE0E6'}`,
          }}
        >
          ↔ Vergelijk
        </button>
        {compareEnabled && (
          <span className="text-xs" style={{ color: '#8C9BAF' }}>vs. {prevFrom} – {prevTo}</span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <KpiCard key={`${c.title}-${c.sub}`} title={c.title} value={c.value} subtitle={c.sub} delta={c.d} deltaInverted={c.inverted} />
        ))}
      </div>
    </div>
  );
}
