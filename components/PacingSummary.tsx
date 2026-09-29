'use client';

import type { ReactNode } from 'react';
import type { Pacing } from '@/types/results';
import { fmtEur, fmtPct } from '@/lib/format';

interface Props {
  pacing: Pacing;
  onChange: (p: Pacing) => void;
  achievedSpend: number;
  kpiSpendTotal: number; // som van alle kanaal-KPI-budgetten — bepaalt het totale mediaspend-target
  // true wanneer de periode al ergens anders wordt gekozen (bv. de eigen
  // datumkiezer boven Kanalen) — toont dan platte tekst i.p.v. een <input
  // type=date> die toch nergens naar zou schrijven.
  datesReadOnly?: boolean;
}

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

function shortDate(iso: string) {
  return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

export default function PacingSummary({ pacing, onChange, achievedSpend, kpiSpendTotal, datesReadOnly }: Props) {
  const start = pacing.startDate ? new Date(pacing.startDate + 'T00:00:00') : null;
  const end = pacing.endDate ? new Date(pacing.endDate + 'T00:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pacingBudget = kpiSpendTotal > 0 ? achievedSpend / kpiSpendTotal : null;

  let pacingLooptijd: number | null = null;
  if (start && end && end > start) {
    const total = daysBetween(start, end);
    const elapsed = Math.min(Math.max(daysBetween(start, today), 0), total);
    pacingLooptijd = elapsed / total;
  }

  const rows: { label: string; content: ReactNode }[] = [
    {
      label: 'Totaal mediaspend',
      content: <span className="text-sm font-semibold tabular-nums" style={{ color: '#22222D' }}>{fmtEur(kpiSpendTotal)}</span>,
    },
    {
      label: 'Startdatum',
      content: datesReadOnly ? (
        <span className="text-xs" style={{ color: '#22222D' }}>{shortDate(pacing.startDate)}</span>
      ) : (
        <input
          type="date"
          value={pacing.startDate}
          onChange={(e) => onChange({ ...pacing, startDate: e.target.value })}
          className="text-xs focus:outline-none"
          style={{ border: 'none', background: 'transparent', color: '#22222D', textAlign: 'right', width: '100%' }}
        />
      ),
    },
    {
      label: 'Einddatum',
      content: datesReadOnly ? (
        <span className="text-xs" style={{ color: '#22222D' }}>{shortDate(pacing.endDate)}</span>
      ) : (
        <input
          type="date"
          value={pacing.endDate}
          onChange={(e) => onChange({ ...pacing, endDate: e.target.value })}
          className="text-xs focus:outline-none"
          style={{ border: 'none', background: 'transparent', color: '#22222D', textAlign: 'right', width: '100%' }}
        />
      ),
    },
    {
      label: 'Pacing obv budget',
      content: <span className="text-sm font-semibold tabular-nums" style={{ color: '#22222D' }}>{pacingBudget !== null ? fmtPct(pacingBudget) : '—'}</span>,
    },
    {
      label: 'Pacing obv looptijd',
      content: <span className="text-sm font-semibold tabular-nums" style={{ color: '#22222D' }}>{pacingLooptijd !== null ? fmtPct(pacingLooptijd) : '—'}</span>,
    },
  ];

  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)', maxWidth: '420px' }}>
      <div className="px-4 py-3" style={{ background: '#1E3A8A' }}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">Budget &amp; pacing</span>
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(({ label, content }) => (
            <tr key={label} style={{ borderBottom: '1px solid #F0F4F8' }} className="last:border-0">
              <td className="py-2 px-4 text-xs" style={{ color: '#555E6C' }}>{label}</td>
              <td className="py-1 px-4 text-right" style={{ width: '160px' }}>{content}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 pb-3 text-xs" style={{ color: '#8C9BAF' }}>
        Achieved spend (alle kanalen): <span className="font-semibold" style={{ color: '#22222D' }}>{fmtEur(achievedSpend)}</span>
      </p>
    </div>
  );
}
