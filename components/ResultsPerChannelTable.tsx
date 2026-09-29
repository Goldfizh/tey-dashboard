'use client';

import { Fragment } from 'react';
import EditableField from '@/components/EditableField';
import EditableNumber from '@/components/EditableNumber';
import { awarenessFromKpi, awarenessFromVolumes, costFor, ratio, volumeFor, emptyAchieved, emptyKpi } from '@/types/results';
import type { ChannelResultRow, MetricPairDef } from '@/types/results';
import { fmtDecimal, fmtEur, fmtNum, fmtPct } from '@/lib/format';

interface Props {
  rows: ChannelResultRow[];
  onChange: (rows: ChannelResultRow[]) => void;
  metricPairs: MetricPairDef[]; // volledige catalogus — per rij wordt hieruit gekozen
}

function fmtOrDash(v: number | null, fmt: (n: number) => string) {
  return v === null ? '—' : fmt(v);
}

export default function ResultsPerChannelTable({ rows, onChange, metricPairs }: Props) {
  // Alleen kolommen tonen voor paren die door minstens één campagne worden gebruikt.
  const activePairs = metricPairs.filter((p) => rows.some((r) => r.activePairKeys.includes(p.key)));
  const extraCols = activePairs.reduce((n, p) => n + (p.rateLabel ? 3 : 2), 0);

  function updateText(rowId: string, field: 'kanaal' | 'campagne', value: string) {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  }

  function updateKpiSpend(rowId: string, value: number) {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, kpi: { ...r.kpi, spend: value } } : r)));
  }

  function updateKpiCost(rowId: string, pairKey: string, value: number) {
    onChange(rows.map((r) =>
      r.id === rowId ? { ...r, kpi: { ...r.kpi, costs: { ...r.kpi.costs, [pairKey]: value } } } : r
    ));
  }

  function updateKpiFrequency(rowId: string, value: number) {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, kpi: { ...r.kpi, frequency: value } } : r)));
  }

  function togglePair(rowId: string, pairKey: string) {
    onChange(rows.map((r) => {
      if (r.id !== rowId) return r;
      const has = r.activePairKeys.includes(pairKey);
      return { ...r, activePairKeys: has ? r.activePairKeys.filter((k) => k !== pairKey) : [...r.activePairKeys, pairKey] };
    }));
  }

  function addRow() {
    const id = `row-${Date.now()}`;
    onChange([...rows, { id, kanaal: 'Nieuw kanaal', campagne: 'Nieuwe campagne', achieved: emptyAchieved(), kpi: emptyKpi(), comments: [], activePairKeys: [] }]);
  }

  function removeRow(rowId: string) {
    onChange(rows.filter((r) => r.id !== rowId));
  }

  return (
    <div>
      <div className="bg-white overflow-x-auto" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
        <table className="w-full" style={{ minWidth: `${900 + extraCols * 95}px` }}>
          <thead style={{ background: '#F0F4F8', borderBottom: '1px solid #DCE0E6' }}>
            <tr>
              <th className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Kanaal</th>
              <th className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Campagne</th>
              <th className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}></th>
              <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Amount spent</th>
              <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Impressies</th>
              <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Bereik</th>
              <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>Frequentie</th>
              <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>CPM</th>
              {activePairs.map((p) => (
                <Fragment key={p.key}>
                  <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>{p.costLabel}</th>
                  <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>{p.volumeLabel}</th>
                  {p.rateLabel && (
                    <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>{p.rateLabel}</th>
                  )}
                </Fragment>
              ))}
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const aAchieved = awarenessFromVolumes(row.achieved);
              const aKpi = awarenessFromKpi(row.kpi);
              return (
                <Fragment key={row.id}>
                  {/* Achieved — vast, uit campagnetooling (hier nog demo-data) */}
                  <tr style={{ borderTop: '2px solid #DCE0E6' }}>
                    <td className="px-3 py-1.5 align-top" rowSpan={2}>
                      <EditableField value={row.kanaal} bold onCommit={(v) => updateText(row.id, 'kanaal', v)} />
                    </td>
                    <td className="px-3 py-1.5 align-top" rowSpan={2} style={{ minWidth: '160px' }}>
                      <EditableField value={row.campagne} onCommit={(v) => updateText(row.id, 'campagne', v)} />
                      {/* Per-campagne metric-keuze — welke doel-bundels tellen hier mee */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {metricPairs.map((p) => {
                          const active = row.activePairKeys.includes(p.key);
                          return (
                            <button
                              key={p.key}
                              onClick={() => togglePair(row.id, p.key)}
                              className="text-[10px] font-semibold px-1.5 py-0.5"
                              style={{
                                borderRadius: '4px',
                                background: active ? '#1E3A8A' : '#ffffff',
                                color: active ? '#ffffff' : '#BCC4CF',
                                border: `1px solid ${active ? '#1E3A8A' : '#DCE0E6'}`,
                              }}
                            >
                              {p.goalLabel ?? p.costLabel}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap" style={{ color: '#22222D' }}>Achieved</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtEur(row.achieved.spend)}</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtNum(aAchieved.impressions)}</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtNum(aAchieved.reach)}</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtOrDash(aAchieved.frequency, fmtDecimal)}</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtOrDash(aAchieved.cpm, fmtEur)}</td>
                    {activePairs.map((p) => {
                      const on = row.activePairKeys.includes(p.key);
                      if (!on) {
                        return (
                          <Fragment key={p.key}>
                            <td className="px-2 py-1.5 text-right text-xs" style={{ color: '#DCE0E6' }}>—</td>
                            <td className="px-2 py-1.5 text-right text-xs" style={{ color: '#DCE0E6' }}>—</td>
                            {p.rateLabel && <td className="px-2 py-1.5 text-right text-xs" style={{ color: '#DCE0E6' }}>—</td>}
                          </Fragment>
                        );
                      }
                      const vol = row.achieved.volumes[p.key] ?? 0;
                      const cost = costFor(row.achieved, p);
                      return (
                        <Fragment key={p.key}>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtOrDash(cost, fmtEur)}</td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtNum(vol)}</td>
                          {p.rateLabel && (
                            <td className="px-2 py-1.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#22222D' }}>{fmtOrDash(ratio(row.achieved, p.key, 'impressions'), fmtPct)}</td>
                          )}
                        </Fragment>
                      );
                    })}
                    <td className="px-2 py-1.5 align-top" rowSpan={2}>
                      <button
                        onClick={() => removeRow(row.id)}
                        title="Rij verwijderen"
                        className="text-xs"
                        style={{ color: '#BCC4CF' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#BCC4CF')}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>

                  {/* KPI — target: budget + kosten-per-x zijn instelbaar, volumes berekend */}
                  <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
                    <td className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap" style={{ color: '#1E3A8A' }}>KPI</td>
                    <td className="px-2 py-1.5">
                      <EditableNumber value={row.kpi.spend} format={fmtEur} onCommit={(v) => updateKpiSpend(row.id, v)} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums" style={{ color: '#8C9BAF' }}>{fmtNum(aKpi.impressions)}</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums" style={{ color: '#8C9BAF' }}>{fmtNum(aKpi.reach)}</td>
                    <td className="px-2 py-1.5">
                      <EditableNumber value={row.kpi.frequency} format={fmtDecimal} onCommit={(v) => updateKpiFrequency(row.id, v)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <EditableNumber value={row.kpi.costs.impressions ?? 0} format={fmtEur} onCommit={(v) => updateKpiCost(row.id, 'impressions', v)} />
                    </td>
                    {activePairs.map((p) => {
                      const on = row.activePairKeys.includes(p.key);
                      if (!on) {
                        return (
                          <Fragment key={p.key}>
                            <td className="px-2 py-1.5 text-right text-xs" style={{ color: '#DCE0E6' }}>—</td>
                            <td className="px-2 py-1.5 text-right text-xs" style={{ color: '#DCE0E6' }}>—</td>
                            {p.rateLabel && <td className="px-2 py-1.5 text-right text-xs" style={{ color: '#DCE0E6' }}>—</td>}
                          </Fragment>
                        );
                      }
                      const cost = row.kpi.costs[p.key] ?? 0;
                      const vol = volumeFor(row.kpi, p);
                      const kpiSv = { spend: row.kpi.spend, volumes: { impressions: aKpi.impressions, [p.key]: vol } };
                      return (
                        <Fragment key={p.key}>
                          <td className="px-2 py-1.5">
                            <EditableNumber value={cost} format={fmtEur} onCommit={(v) => updateKpiCost(row.id, p.key, v)} />
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums" style={{ color: '#8C9BAF' }}>{fmtNum(vol)}</td>
                          {p.rateLabel && (
                            <td className="px-2 py-1.5 text-right text-xs tabular-nums" style={{ color: '#8C9BAF' }}>{fmtOrDash(ratio(kpiSv, p.key, 'impressions'), fmtPct)}</td>
                          )}
                        </Fragment>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="mt-3 text-xs font-semibold px-3 py-1.5"
        style={{ borderRadius: '4px', background: '#ffffff', color: '#1E3A8A', border: '1px solid #1E3A8A44' }}
      >
        + Rij toevoegen
      </button>
    </div>
  );
}
