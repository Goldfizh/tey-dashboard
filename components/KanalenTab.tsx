'use client';

import { useEffect, useMemo, useState } from 'react';
import PacingSummary from '@/components/PacingSummary';
import PacingChart from '@/components/PacingChart';
import GoalDailyChart from '@/components/GoalDailyChart';
import TotalsResultsTable from '@/components/TotalsResultsTable';
import CommentsTable from '@/components/CommentsTable';
import MetricsFlatTable from '@/components/MetricsFlatTable';
import ComparisonTool from '@/components/ComparisonTool';
import type { ChannelResultRow, MetricPairDef, Pacing } from '@/types/results';
import { kpiToSpendVolumes, sumSpendVolumes } from '@/types/results';
import type { CampaignRow } from '@/types/campaign';
import { buildDailyEntities, buildRawGroups } from '@/lib/resultsAdapter';

interface Props {
  resultRows: ChannelResultRow[]; // alle campagnes, alle actieve kanalen
  rawRows: CampaignRow[]; // ruwe (dag-niveau) rijen — voor de dag-grafieken van de selectie
  metricPairs: MetricPairDef[]; // volledige catalogus
  pacing: Pacing;
  onChangeRows: (rows: ChannelResultRow[]) => void;
  onChangePacing: (p: Pacing) => void;
}

export default function KanalenTab({ resultRows, rawRows, metricPairs, pacing, onChangeRows, onChangePacing }: Props) {
  const kanalen = [...new Set(resultRows.map((r) => r.kanaal))].sort();
  const [selectedKanaal, setSelectedKanaal] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const rawGroups = useMemo(() => buildRawGroups(rawRows), [rawRows]);

  useEffect(() => {
    if (!selectedKanaal && kanalen.length > 0) setSelectedKanaal(kanalen[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanalen, selectedKanaal]);

  const campagnes = useMemo(
    () => resultRows.filter((r) => r.kanaal === selectedKanaal),
    [resultRows, selectedKanaal],
  );

  // Bij wisselen van kanaal: standaard alle campagnes van dat kanaal aangevinkt.
  useEffect(() => {
    setSelectedIds(new Set(campagnes.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKanaal]);

  function toggleCampagne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selected = campagnes.filter((c) => selectedIds.has(c.id));
  const activePairs = metricPairs.filter((p) => selected.some((r) => r.activePairKeys.includes(p.key)));
  const achievedSpend = selected.reduce((s, r) => s + r.achieved.spend, 0);
  const kpiSpendTotal = sumSpendVolumes(selected.map((r) => kpiToSpendVolumes(r.kpi, activePairs))).spend;

  const dailyGroup = useMemo(() => {
    const rows: CampaignRow[] = [];
    for (const c of selected) rows.push(...(rawGroups.get(c.id)?.rows ?? []));
    return buildDailyEntities(rows);
  }, [selected, rawGroups]);

  return (
    <div className="space-y-8">
      {/* Kanaal- en campagnekeuze */}
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="gf-eyebrow mb-2">Kanaal</p>
          <select
            value={selectedKanaal}
            onChange={(e) => setSelectedKanaal(e.target.value)}
            className="text-sm font-semibold px-3 py-2"
            style={{ border: '1px solid #DCE0E6', borderRadius: '6px', color: '#22222D', background: '#ffffff' }}
          >
            {kanalen.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <p className="gf-eyebrow mb-2">Campagne(s)</p>
          <div className="flex flex-wrap gap-2">
            {campagnes.length === 0 && (
              <p className="text-sm" style={{ color: '#8C9BAF' }}>Nog geen data voor dit kanaal.</p>
            )}
            {campagnes.map((c) => {
              const active = selectedIds.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCampagne(c.id)}
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{
                    borderRadius: '5px',
                    background: active ? '#1E3A8A' : '#ffffff',
                    color: active ? '#ffffff' : '#555E6C',
                    border: `1px solid ${active ? '#1E3A8A' : '#DCE0E6'}`,
                  }}
                >
                  {c.campagne}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected.length === 0 ? (
        <p className="text-sm" style={{ color: '#8C9BAF' }}>Kies minstens één campagne om de resultaten te zien.</p>
      ) : (
        <>
          <h1 className="gf-display text-2xl" style={{ color: '#22222D' }}>{selectedKanaal}</h1>

          <div>
            <h2 className="gf-eyebrow mb-5">Budget &amp; pacing</h2>
            <div className="flex flex-wrap items-start gap-4">
              <PacingSummary pacing={pacing} onChange={onChangePacing} achievedSpend={achievedSpend} kpiSpendTotal={kpiSpendTotal} />
              <PacingChart dailyEntities={dailyGroup} pacing={pacing} kpiSpendTotal={kpiSpendTotal} />
            </div>
          </div>

          {activePairs.length > 0 && (
            <div>
              <h2 className="gf-eyebrow mb-5">Resultaten per dag — per doelstelling</h2>
              <div className="space-y-4">
                {activePairs.map((p) => (
                  <GoalDailyChart key={p.key} pair={p} dailyEntities={dailyGroup} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="gf-eyebrow mb-5">Resultaten</h2>
            <TotalsResultsTable rows={selected} metricPairs={activePairs} />
          </div>

          <div>
            <h2 className="gf-eyebrow mb-5">Optimalisaties &amp; opvallendheden</h2>
            <CommentsTable rows={resultRows} selectedRowIds={campagnes.map((r) => r.id)} onChange={onChangeRows} />
          </div>

          <div>
            <h2 className="gf-eyebrow mb-5">Campagnes</h2>
            <MetricsFlatTable
              labelHeader="Campagne"
              entities={[...selected].sort((a, b) => a.campagne.localeCompare(b.campagne)).map((c) => ({ label: c.campagne, metrics: c.achieved }))}
              metricPairs={activePairs}
            />
          </div>

          <div>
            <h2 className="gf-eyebrow mb-5">Resultaten per dag</h2>
            <MetricsFlatTable
              labelHeader="Dag"
              entities={dailyGroup.map((d) => ({ label: new Date(d.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }), sortValue: d.date, metrics: d.metrics }))}
              metricPairs={activePairs}
              maxHeight="420px"
            />
          </div>

          <div>
            <h2 className="gf-eyebrow mb-5">Vergelijken op periode</h2>
            <ComparisonTool dailyEntities={dailyGroup} metricPairs={activePairs} />
          </div>
        </>
      )}
    </div>
  );
}
