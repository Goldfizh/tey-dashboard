'use client';

import { useEffect, useMemo, useState } from 'react';
import PacingSummary from '@/components/PacingSummary';
import PacingChart from '@/components/PacingChart';
import GoalDailyChart from '@/components/GoalDailyChart';
import TotalsResultsTable from '@/components/TotalsResultsTable';
import CommentsTable from '@/components/CommentsTable';
import MetricsFlatTable from '@/components/MetricsFlatTable';
import ComparisonTool from '@/components/ComparisonTool';
import type { ChannelResultRow, MetricPairDef, Pacing, SpendVolumes } from '@/types/results';
import { kpiToSpendVolumes, sumSpendVolumes } from '@/types/results';
import type { CampaignRow } from '@/types/campaign';
import { buildDailyEntities, buildRawGroups } from '@/lib/resultsAdapter';

interface DrilldownRow {
  label: string;
  metrics: SpendVolumes;
}

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

  const selected = useMemo(() => campagnes.filter((c) => selectedIds.has(c.id)), [campagnes, selectedIds]);
  const activePairs = metricPairs.filter((p) => selected.some((r) => r.activePairKeys.includes(p.key)));
  const achievedSpend = selected.reduce((s, r) => s + r.achieved.spend, 0);
  const kpiSpendTotal = sumSpendVolumes(selected.map((r) => kpiToSpendVolumes(r.kpi, activePairs))).spend;

  const dailyGroup = useMemo(() => {
    const rows: CampaignRow[] = [];
    for (const c of selected) rows.push(...(rawGroups.get(c.id)?.rows ?? []));
    return buildDailyEntities(rows);
  }, [selected, rawGroups]);

  // Doelgroep-/advertentieniveau — live via /api/meta/breakdown (lib/meta.ts, rechtstreeks de
  // Graph API), alleen voor Meta. LinkedIn koopt per advertentieset in (dus geen apart
  // doelgroepniveau nodig) en heeft nog geen werkende databron op dit niveau; YouTube heeft geen
  // van beide niveaus. Gescopet op exact de geselecteerde campagne(s) — wisselt de selectie, dan
  // ververst dit automatisch mee, dus geen data van niet-geselecteerde campagnes lekt hierin door.
  const multiSelected = selected.length > 1;
  const [breakdown, setBreakdown] = useState<{ doelgroep: DrilldownRow[]; advertentie: DrilldownRow[]; status: 'idle' | 'loading' | 'error'; error?: string }>({
    doelgroep: [], advertentie: [], status: 'idle',
  });

  useEffect(() => {
    if (selectedKanaal !== 'Meta' || selected.length === 0) {
      setBreakdown({ doelgroep: [], advertentie: [], status: 'idle' });
      return;
    }
    let cancelled = false;
    setBreakdown((prev) => ({ ...prev, status: 'loading' }));
    const campagneParam = encodeURIComponent(selected.map((c) => c.campagne).join(','));
    const toRows = (rows: { campagne: string; name: string; achieved: SpendVolumes }[]): DrilldownRow[] =>
      rows.map((r) => ({ label: multiSelected ? `${r.campagne} — ${r.name}` : r.name, metrics: r.achieved }));

    Promise.all([
      fetch(`/api/meta/breakdown?level=adset&campagnes=${campagneParam}`).then((r) => r.json()),
      fetch(`/api/meta/breakdown?level=ad&campagnes=${campagneParam}`).then((r) => r.json()),
    ]).then(([adsetRes, adRes]: [{ rows?: { campagne: string; name: string; achieved: SpendVolumes }[]; error?: string }, { rows?: { campagne: string; name: string; achieved: SpendVolumes }[]; error?: string }]) => {
      if (cancelled) return;
      if (adsetRes.error || adRes.error) {
        setBreakdown({ doelgroep: [], advertentie: [], status: 'error', error: adsetRes.error ?? adRes.error });
        return;
      }
      setBreakdown({ doelgroep: toRows(adsetRes.rows ?? []), advertentie: toRows(adRes.rows ?? []), status: 'idle' });
    }).catch((err) => {
      if (!cancelled) setBreakdown({ doelgroep: [], advertentie: [], status: 'error', error: err instanceof Error ? err.message : 'Onbekende fout' });
    });
    return () => { cancelled = true; };
  }, [selectedKanaal, selected, multiSelected]);

  return (
    <div className="space-y-8">
      {/* Kanaalkeuze — altijd alle opties meteen zichtbaar, geen dropdown */}
      <div>
        <p className="gf-eyebrow mb-2">Kanaal</p>
        <div className="flex flex-wrap gap-2">
          {kanalen.map((k) => {
            const active = selectedKanaal === k;
            return (
              <button
                key={k}
                onClick={() => setSelectedKanaal(k)}
                className="text-sm font-semibold px-4 py-2"
                style={{
                  borderRadius: '6px',
                  background: active ? '#1E3A8A' : '#ffffff',
                  color: active ? '#ffffff' : '#555E6C',
                  border: `1px solid ${active ? '#1E3A8A' : '#DCE0E6'}`,
                }}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {/* Campagnekeuze — pas zichtbaar na het kiezen van een kanaal */}
      {selectedKanaal && (
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
      )}

      {!selectedKanaal ? (
        <p className="text-sm" style={{ color: '#8C9BAF' }}>Kies eerst een kanaal hierboven.</p>
      ) : selected.length === 0 ? (
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

          {selectedKanaal === 'Meta' && (
            <div>
              <h2 className="gf-eyebrow mb-5">Resultaten per doelgroep</h2>
              {breakdown.status === 'error' ? (
                <p className="text-sm" style={{ color: '#B42318' }}>Meta: {breakdown.error}</p>
              ) : breakdown.status === 'loading' ? (
                <p className="text-sm" style={{ color: '#8C9BAF' }}>Laden…</p>
              ) : breakdown.doelgroep.length === 0 ? (
                <p className="text-sm" style={{ color: '#8C9BAF' }}>Geen doelgroep-data voor deze selectie.</p>
              ) : (
                <MetricsFlatTable labelHeader="Doelgroep" entities={breakdown.doelgroep} metricPairs={activePairs} />
              )}
            </div>
          )}

          {(selectedKanaal === 'Meta' || selectedKanaal === 'LinkedIn') && (
            <div>
              <h2 className="gf-eyebrow mb-5">Resultaten per advertentie</h2>
              {selectedKanaal === 'LinkedIn' ? (
                <p className="text-sm" style={{ color: '#8C9BAF' }}>
                  Nog geen advertentie-niveau voor LinkedIn — alleen campagne-niveau is gekoppeld.
                </p>
              ) : breakdown.status === 'error' ? (
                <p className="text-sm" style={{ color: '#B42318' }}>Meta: {breakdown.error}</p>
              ) : breakdown.status === 'loading' ? (
                <p className="text-sm" style={{ color: '#8C9BAF' }}>Laden…</p>
              ) : breakdown.advertentie.length === 0 ? (
                <p className="text-sm" style={{ color: '#8C9BAF' }}>Geen advertentie-data voor deze selectie.</p>
              ) : (
                <MetricsFlatTable labelHeader="Advertentie" entities={breakdown.advertentie} metricPairs={activePairs} />
              )}
            </div>
          )}

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
