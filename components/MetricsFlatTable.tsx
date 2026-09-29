'use client';

import { useMemo, useState } from 'react';
import { awarenessFromVolumes, costFor, ratio } from '@/types/results';
import type { MetricPairDef, SpendVolumes } from '@/types/results';
import { fmtDecimal, fmtEur, fmtNum, fmtPct } from '@/lib/format';

interface Entity {
  label: string;
  metrics: SpendVolumes;
  // Alleen nodig als de weergegeven label niet zelf de juiste sorteervolgorde
  // oplevert (bv. "18/09/2026" als tekst sorteert niet chronologisch) — de
  // aanroeper geeft dan een aparte, wél sorteerbare waarde mee (bv. de ISO-datum).
  sortValue?: string;
}

interface Props {
  labelHeader: string; // bv. "Campaign Name", "Ad Set Name", "Ad Name", "Day"
  entities: Entity[]; // vaste volgorde — de aanroeper bepaalt de standaardsortering (bv. alfabetisch, of chronologisch bij dagen)
  metricPairs: MetricPairDef[]; // extra metrics — Bekendheid komt er altijd apart bij
  maxHeight?: string; // voor lange lijsten (bv. dagelijkse data) een scrollbare body
}

interface Column {
  key: string;
  label: string;
  getValue: (e: Entity) => number | null;
  format: (v: number) => string;
  bold?: boolean;
}

function fmtOrDash(v: number | null, fmt: (n: number) => string) {
  return v === null ? '—' : fmt(v);
}

// Sleutel voor de eerste kolom (naam/dag) — geen entry in `columns`, want die
// sorteert op tekst i.p.v. een getal, maar werkt verder hetzelfde (klik = A-Z
// of vroegste dag eerst, nogmaals klikken = omgekeerd).
const LABEL_KEY = '__label__';

// Eén rij per entiteit (campagne/doelgroep/advertentie/dag) — alleen achieved-stijl
// cijfers, geen KPI-kolom. Dezelfde metric-kolommen als "Resultaten per kanaal &
// campagne", zodat de niveaus onderling vergelijkbaar blijven.
//
// Klikken op een metric-kolom sorteert de tabel op die kolom (hoogste eerst,
// nogmaals klikken = laagste eerst) — puur visueel via het kleine pijltje
// naast de kolomnaam, geen aparte "sorteren"-UI. Zonder actieve sortering
// staat de tabel in de volgorde die de aanroeper meegeeft.
export default function MetricsFlatTable({ labelHeader, entities, metricPairs, maxHeight }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const columns: Column[] = useMemo(() => {
    const awareness = (e: Entity) => awarenessFromVolumes(e.metrics);
    const base: Column[] = [
      { key: 'spend', label: 'Amount spent', getValue: (e) => e.metrics.spend, format: fmtEur, bold: true },
      { key: 'impressions', label: 'Impressies', getValue: (e) => awareness(e).impressions, format: fmtNum, bold: true },
      { key: 'reach', label: 'Bereik', getValue: (e) => awareness(e).reach, format: fmtNum },
      { key: 'frequency', label: 'Frequentie', getValue: (e) => awareness(e).frequency, format: fmtDecimal },
      { key: 'cpm', label: 'CPM', getValue: (e) => awareness(e).cpm, format: fmtEur },
    ];
    const pairCols: Column[] = metricPairs.flatMap((p) => {
      const cols: Column[] = [
        { key: `${p.key}_cost`, label: p.costLabel, getValue: (e) => costFor(e.metrics, p), format: fmtEur },
        { key: `${p.key}_volume`, label: p.volumeLabel, getValue: (e) => e.metrics.volumes[p.key] ?? 0, format: fmtNum, bold: true },
      ];
      if (p.rateLabel) {
        cols.push({ key: `${p.key}_rate`, label: p.rateLabel, getValue: (e) => ratio(e.metrics, p.key, 'impressions'), format: fmtPct });
      }
      return cols;
    });
    return [...base, ...pairCols];
  }, [metricPairs]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortedEntities = useMemo(() => {
    if (sortKey === LABEL_KEY) {
      return [...entities].sort((a, b) => {
        const cmp = (a.sortValue ?? a.label).localeCompare(b.sortValue ?? b.label);
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    const col = sortKey ? columns.find((c) => c.key === sortKey) : undefined;
    if (!col) return entities;
    // Ontbrekende waarden (—) altijd onderaan, ongeacht sorteerrichting.
    return entities
      .map((e, i) => ({ e, i, v: col.getValue(e) }))
      .sort((a, b) => {
        if (a.v === null && b.v === null) return a.i - b.i;
        if (a.v === null) return 1;
        if (b.v === null) return -1;
        return sortDir === 'desc' ? b.v - a.v : a.v - b.v;
      })
      .map((x) => x.e);
  }, [entities, sortKey, sortDir, columns]);

  return (
    <div className="bg-white overflow-x-auto" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className={maxHeight ? 'overflow-y-auto' : ''} style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full" style={{ minWidth: '760px' }}>
          <thead style={{ background: '#F0F4F8', borderBottom: '1px solid #DCE0E6', position: maxHeight ? 'sticky' : undefined, top: 0 }}>
            <tr>
              <th
                onClick={() => handleSort(LABEL_KEY)}
                className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
                style={{ color: sortKey === LABEL_KEY ? '#1E3A8A' : '#8C9BAF' }}
                title={`Sorteer op ${labelHeader}`}
              >
                {labelHeader}
                {sortKey === LABEL_KEY && (
                  <span style={{ marginLeft: '3px', fontSize: '9px' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
                )}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="py-3 px-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none"
                  style={{ color: sortKey === col.key ? '#1E3A8A' : '#8C9BAF' }}
                  title={`Sorteer op ${col.label}`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: '3px', fontSize: '9px' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedEntities.map((e, i) => (
              <tr key={`${e.label}-${i}`} style={{ borderBottom: '1px solid #F0F4F8' }} className="last:border-0">
                <td className="px-3 py-2 text-xs font-medium whitespace-nowrap" style={{ color: '#22222D' }}>{e.label}</td>
                {columns.map((col) => {
                  const v = col.getValue(e);
                  return (
                    <td
                      key={col.key}
                      className="px-2 py-2 text-right text-xs tabular-nums"
                      style={{ color: col.bold ? '#22222D' : '#555E6C', fontWeight: col.bold ? 600 : undefined }}
                    >
                      {fmtOrDash(v, col.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedEntities.length === 0 && (
              <tr><td colSpan={1 + columns.length} className="px-3 py-6 text-center text-xs" style={{ color: '#8C9BAF' }}>Geen data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
