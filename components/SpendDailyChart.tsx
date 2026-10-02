'use client';

import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyEntity } from '@/lib/channelDrilldown';
import { fmtEur } from '@/lib/format';

interface Props {
  dailyEntities: DailyEntity[];
}

function shortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Losse spend-per-dag-grafiek — onafhankelijk van welke doelstelling/metric-paren actief zijn,
// zodat budgetverbruik altijd zichtbaar is, ook zonder gekozen doel-bundel.
export default function SpendDailyChart({ dailyEntities }: Props) {
  const data = dailyEntities.map((d) => ({ label: shortDate(d.date), spend: d.metrics.spend }));

  if (data.length === 0) {
    return (
      <div className="bg-white flex items-center justify-center" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', minHeight: '260px' }}>
        <p className="text-xs" style={{ color: '#8C9BAF' }}>Geen data binnen de campagneperiode</p>
      </div>
    );
  }

  return (
    <div className="bg-white" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)', padding: '16px' }}>
      <span className="gf-eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Spend per dag</span>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#F0F4F8" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C9BAF' }} axisLine={{ stroke: '#DCE0E6' }} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: '#1E3A8A' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtEur(v)} width={60} />
          <Tooltip
            formatter={(value) => {
              const num = typeof value === 'number' ? value : Number(value);
              return [Number.isNaN(num) ? '—' : fmtEur(num), 'Spend'];
            }}
            labelStyle={{ color: '#22222D', fontWeight: 600 }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E6' }}
          />
          <Bar dataKey="spend" name="Spend" fill="#1E3A8A" radius={[3, 3, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
