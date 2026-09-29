'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyEntity } from '@/lib/channelDrilldown';
import type { Pacing } from '@/types/results';
import { fmtEur } from '@/lib/format';

interface Props {
  dailyEntities: DailyEntity[];
  pacing: Pacing;
  kpiSpendTotal: number;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function shortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Uitgegeven budget per dag (balken) tegen een vlakke "verwacht per dag"-lijn
// (KPI-budget ÷ campagneduur) — zo zie je per dag of je boven of onder het
// geplande dagbudget zit, i.p.v. een cumulatief totaal dat dat verschil verbergt.
export default function PacingChart({ dailyEntities, pacing, kpiSpendTotal }: Props) {
  const start = pacing.startDate ? new Date(pacing.startDate + 'T00:00:00') : null;
  const end = pacing.endDate ? new Date(pacing.endDate + 'T00:00:00') : null;
  const totalCampaignDays = start && end && end > start ? daysBetween(start, end) + 1 : null;
  const dailyTarget = totalCampaignDays ? kpiSpendTotal / totalCampaignDays : null;

  const data = dailyEntities.map((d) => ({ label: shortDate(d.date), achieved: d.metrics.spend, verwacht: dailyTarget }));

  if (data.length === 0) {
    return (
      <div className="bg-white flex items-center justify-center" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', flex: 1, minHeight: '260px' }}>
        <p className="text-xs" style={{ color: '#8C9BAF' }}>Geen data binnen de campagneperiode</p>
      </div>
    );
  }

  return (
    <div className="bg-white" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)', flex: 1, minWidth: 0, padding: '16px' }}>
      <span className="gf-eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Budget over tijd</span>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#F0F4F8" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C9BAF' }} axisLine={{ stroke: '#DCE0E6' }} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: '#8C9BAF' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtEur(v)} width={70} />
          <Tooltip formatter={(v) => fmtEur(typeof v === 'number' ? v : Number(v))} labelStyle={{ color: '#22222D', fontWeight: 600 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E6' }} />
          <Bar dataKey="achieved" name="Achieved (per dag)" fill="#1E3A8A" radius={[3, 3, 0, 0]} />
          <Line type="linear" dataKey="verwacht" name="Verwacht per dag" stroke="#8C9BAF" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
