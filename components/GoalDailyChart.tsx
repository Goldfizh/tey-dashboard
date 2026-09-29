'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyEntity } from '@/lib/channelDrilldown';
import { costFor } from '@/types/results';
import type { MetricPairDef } from '@/types/results';
import { fmtEur, fmtNum } from '@/lib/format';

interface Props {
  pair: MetricPairDef; // de actieve doel-bundel (Verkeer/Views/Leads) uit Totaaloverzicht
  dailyEntities: DailyEntity[];
}

const SECONDARY_COLOR = '#0F9B8E'; // zelfde teal als de Analyse-tab voor "het afgeleide getal"

function shortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Vaste grafiek per actieve doelstelling: balken = volume van die dag
// (Clicks/Completed views/Conversies), lijn = de écht behaalde kosten-per-x
// van die dag (CPC/CPCV/CPA) — geen verwachting/target zoals bij Budget over
// tijd, puur wat er die dag daadwerkelijk gebeurde.
export default function GoalDailyChart({ pair, dailyEntities }: Props) {
  const data = dailyEntities.map((d) => ({
    label: shortDate(d.date),
    volume: d.metrics.volumes[pair.key] ?? 0,
    cost: costFor(d.metrics, pair),
  }));

  if (data.length === 0) {
    return (
      <div className="bg-white flex items-center justify-center" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', minHeight: '260px' }}>
        <p className="text-xs" style={{ color: '#8C9BAF' }}>Geen data binnen de campagneperiode</p>
      </div>
    );
  }

  return (
    <div className="bg-white" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)', padding: '16px' }}>
      <span className="gf-eyebrow" style={{ display: 'block', marginBottom: '8px' }}>{pair.volumeLabel} &amp; {pair.costLabel} per dag</span>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#F0F4F8" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C9BAF' }} axisLine={{ stroke: '#DCE0E6' }} tickLine={false} minTickGap={24} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#1E3A8A' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v)} width={50} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: SECONDARY_COLOR }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtEur(v)} width={60} />
          <Tooltip
            formatter={(value, name) => {
              const num = typeof value === 'number' ? value : Number(value);
              if (Number.isNaN(num)) return ['—', name];
              return name === pair.costLabel ? [fmtEur(num), name] : [fmtNum(num), name];
            }}
            labelStyle={{ color: '#22222D', fontWeight: 600 }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E6' }}
          />
          <Bar yAxisId="left" dataKey="volume" name={pair.volumeLabel} fill="#1E3A8A" radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="cost" name={pair.costLabel} stroke={SECONDARY_COLOR} strokeWidth={2} dot={data.length <= 40} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
